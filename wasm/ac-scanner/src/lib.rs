#![no_std]

use core::slice;

#[panic_handler]
fn panic_handler(_info: &core::panic::PanicInfo) -> ! {
    loop {}
}

/* ---------- Aho-Corasick WASM Scanner ----------
   Memory layout (set by JS):
   Offset 0:          automaton data
   Offset 4+4*N:      text input
   Offset 4+4*N+text: result buffer

   Automaton serialization (flat u32 array, little-endian):
   [0]:           num_nodes (N)
   [1..1+N]:      fail_links[f1, f2, ..., fN]
   [1+N..1+2N]:   output_counts[c1, c2, ..., cN]
   Then:          flat output pattern indices (sum of ci entries)
   Then:          edge_table: N * 256 u32 entries (next_node for each byte, 0 = no transition)
*/

const HEADER_SIZE: u32 = 1; // num_nodes field
const PER_NODE_FAIL: u32 = 1;
const PER_NODE_OUTPUT_COUNT: u32 = 1;
const EDGE_TABLE_ENTRIES: u32 = 256;
const MAX_RESULTS: usize = 4096;
const RESULT_ENTRY_SIZE: u32 = 2; // position, pattern_index per match

/* ---------- Scan ----------
   Scans text at text_ptr of given text_len.
   Uses the automaton already initialized in linear memory at AUTOMATON_OFFSET.
   Writes results to result_ptr:
     [0]: match_count (u32)
     [1..]: (position: u32, pattern_index: u32) pairs
   Returns match_count.
*/
#[no_mangle]
pub unsafe extern "C" fn ac_scan(
    automaton_ptr: *const u32,
    text_ptr: *const u8,
    text_len: u32,
    result_ptr: *mut u32,
) -> u32 {
    let num_nodes = *automaton_ptr;
    if num_nodes == 0 || num_nodes > 100_000 {
        return 0;
    }

    let text = slice::from_raw_parts(text_ptr, text_len as usize);

    // Pointers into the serialized automaton
    let fail_base = automaton_ptr.add(1);
    let output_count_base = fail_base.add(num_nodes as usize);
    // output_data starts after fail_links + output_counts
    let output_data = output_count_base.add(num_nodes as usize);
    // edge table starts after output data (sum of all output_counts)
    let mut total_outputs = 0usize;
    for i in 0..num_nodes as usize {
        total_outputs += *output_count_base.add(i) as usize;
    }
    let edge_table = output_data.add(total_outputs);
    // edge_table is indexed: edge_table[node * 256 + byte]

    // Scan loop
    let mut node = 0usize;
    let mut match_count = 0u32;

    for &byte in text {
        // Follow transitions
        let idx = node * 256 + byte as usize;
        let next = *edge_table.add(idx);

        if next != 0 {
            node = next as usize;
        } else if node != 0 {
            // Follow failure links until we find a transition or hit root
            let mut f = node;
            loop {
                f = *fail_base.add(f) as usize;
                if f == 0 {
                    break;
                }
                let fidx = f * 256 + byte as usize;
                if *edge_table.add(fidx) != 0 {
                    node = *edge_table.add(fidx) as usize;
                    break;
                }
            }
            if f == 0 && node != 0 {
                // Check root transition
                let ridx = byte as usize; // root transitions start at 0
                if *edge_table.add(ridx) != 0 {
                    node = *edge_table.add(ridx) as usize;
                } else {
                    node = 0;
                }
            }
        }

        // Collect outputs at current node
        let oc = *output_count_base.add(node) as usize;
        if oc > 0 && (match_count as usize) < MAX_RESULTS {
            // Output patterns are stored consecutively in output_data
            // Each node's outputs start at the cumulative sum of prev outputs
            // Compute the starting offset for this node's outputs
            let mut out_start = 0usize;
            for j in 0..node {
                out_start += *output_count_base.add(j) as usize;
            }
            for j in 0..oc {
                if (match_count as usize) >= MAX_RESULTS {
                    break;
                }
                let pat_idx = *output_data.add(out_start + j);
                *result_ptr.add(1 + (match_count as usize) * 2) = pat_idx;
                match_count += 1;
            }
        }
    }

    // Write total match count at result_ptr[0]
    *result_ptr = match_count;
    match_count
}

/* ---------- Dense edge table builder ----------
   Converts sparse edge data into dense 256-entry table.
   Input format (at data_ptr):
     For each node i:
       [num_edges: u32]
       for each edge: [char: u32, target: u32]
   Output: dense table at the same location (in-place conversion OK since
   dense is larger than sparse).

   Returns number of bytes written for the edge table.
*/
#[no_mangle]
pub unsafe extern "C" fn ac_build_edge_table(
    automaton_ptr: *mut u32,
) -> u32 {
    let num_nodes = *automaton_ptr;
    if num_nodes == 0 || num_nodes > 100_000 {
        return 0;
    }

    let fail_base = automaton_ptr.add(1);
    let output_count_base = fail_base.add(num_nodes as usize);

    // Find where output data ends and sparse edges begin
    let mut total_outputs = 0usize;
    for i in 0..num_nodes as usize {
        total_outputs += *output_count_base.add(i) as usize;
    }
    let mut sparse_ptr = output_count_base.add(total_outputs);

    // Compute dense edge table offset (right after sparse data ends)
    // First pass: find where sparse data ends
    let mut sparse_end = sparse_ptr;
    for _i in 0..num_nodes as usize {
        let num_edges = *sparse_end;
        sparse_end = sparse_end.add(1 + (num_edges as usize) * 2);
    }

    // Dense table starts at sparse_end
    let dense = sparse_end;
    // Zero out the dense table
    let dense_size = (num_nodes as usize) * 256;
    for i in 0..dense_size {
        *dense.add(i) = 0;
    }

    // Populate dense table from sparse
    sparse_ptr = output_count_base.add(total_outputs);
    for node in 0..num_nodes as usize {
        let num_edges = *sparse_ptr as usize;
        sparse_ptr = sparse_ptr.add(1);
        for _e in 0..num_edges {
            let ch = *sparse_ptr as usize;
            let target = *(sparse_ptr.add(1));
            sparse_ptr = sparse_ptr.add(2);
            if ch < 256 {
                *dense.add(node * 256 + ch) = target;
            }
        }
    }

    ((num_nodes as usize) * 256 * 4) as u32
}
