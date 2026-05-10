document.addEventListener('DOMContentLoaded', function() {
  var back = document.querySelector('.back');
  if (history.length <= 1) back.href = chrome.runtime.getURL('popup.html');
  document.getElementById('btcAddress').addEventListener('click', function() {
    navigator.clipboard.writeText('1FTDxfsegMFBeBKcNZhitPPybxeCcRok8a').then(function() {
      var msg = document.getElementById('copiedMsg');
      msg.style.display = 'block';
      setTimeout(function() { msg.style.display = 'none'; }, 2000);
    });
  });
});
