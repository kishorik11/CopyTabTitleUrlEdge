﻿/**
 * 共通処理
 */

// ブラウザ判定
function isEdge() {
  return isEdge.edge;
}
isEdge.edge = typeof chrome === 'object'
           && Object.keys(chrome).length == 1
           && typeof chrome.app === 'object'
           && Object.keys(chrome.app).length == 1
           && Object.keys(chrome.app)[0] == 'getDetails';
function isFirefox() {
  try {
    browser;
    return !isEdge();
  } catch (e) {}
  return false;
}
function isChrome() { // Chrome or Opera
  return !(isEdge() || isFirefox());
}
try {
  // Edge対策(chromeを使用しない前提)
  chrome = browser;
} catch (e) {}

// ストレージの初期値
var defaultStorageValueSet = {
  menu_all: false,
  menu_page: false,
  menu_tab: true,       // Firefox only
  item_CopyTabTitleUrl: true,
  item_CopyTabTitle: true,
  item_CopyTabUrl: true,
  item_CopyTabFormat: false,
  item_CopyTabAllTitleUrl: false,
  item_CopyTabAllTitle: false,
  item_CopyTabAllUrl: false,
  item_CopyTabAllFormat: false,
  action: 'Popup',
  action_target: 'CurrentTab',
  action_action: 'CopyTabTitleUrl',
  format_CopyTabFormat: '[${title}](${url})',
  format_newline: false,
  format_enter: true,
  format_html: false,
  format_extension: false
};

// ストレージの取得
function getStorageArea() {
  //return (chrome.storage.sync ? chrome.storage.sync : chrome.storage.local);
  return chrome.storage.local;
}

// 改行文字を取得
function getEnterCode() {
  let enter = '\n';
  if (window.navigator.platform.indexOf('Win') == 0) {
    // Windows
    enter = '\r\n';
  } else {
    // Mac/Linux
    enter = '\n';
  }
  return enter;
}

// クリップボードにコピー
function copyToClipboard(text, valueSet) {
  function oncopy(event) {
    document.removeEventListener('copy', oncopy, true);
    event.stopImmediatePropagation();
    
    event.preventDefault();
    event.clipboardData.setData('text/plain', text);
    if (valueSet && valueSet.format_extension && valueSet.format_html) {
      event.clipboardData.setData('text/html', text);
    }
  }
  document.addEventListener('copy', oncopy, true);
  
  document.execCommand('copy');
}

function createCopyTabFormat(tab, index, valueSet) {
  let format = valueSet.format_CopyTabFormat;
  if (valueSet.format_extension === true) {
    let newline = (valueSet.format_newline === true)? '\n': getEnterCode();
    format = format.replace(/\${index}/ig, index)
                   .replace(/\${tab}/ig, '\t')
                   .replace(/\${enter}/ig, newline);
  }
  return format.replace(/\${title}/ig, tab.title)
               .replace(/\${url}/ig, tab.url);
}

// タブをクリップボードにコピー
function copyTabs(type, query, valueSet, callback) {
  let enter = getEnterCode();
  let separator = (valueSet.format_extension && valueSet.format_enter !== true)? '': enter;
  if (separator != '' && valueSet.format_extension && valueSet.format_newline === true) {
    separator = '\n';
  }
  
  // すべてのタブ: {}
  // カレントウィンドウのすべてのタブ: {currentWindow:true}
  // カレントウィンドウのアクティブタブ: {currentWindow:true, active:true}
  chrome.tabs.query(query, function(tabs) {
    let temp = [];
    for (let i=0; i<tabs.length; i++) {
      switch (type) {
      case 0: temp.push(tabs[i].title+enter+tabs[i].url); break;
      case 1: temp.push(tabs[i].title); break;
      case 2: temp.push(tabs[i].url); break;
      case 3: temp.push(createCopyTabFormat(tabs[i], i+1, valueSet)); break;
      }
    }
    copyToClipboard(temp.join(separator), valueSet);
    if (callback) {
      // 処理完了通知
      callback();
    }
  });
}
function onCopyTabs(type, query, callback) {
  if (type == 3) {
    getStorageArea().get(defaultStorageValueSet, function(item) {
      copyTabs(type, query, item, callback);
    });
  } else {
    copyTabs(type, query, defaultStorageValueSet, callback);
  }
}

function onContextMenus(info, tab) {
  let type = 0;
  switch (info.menuItemId) {
  case 'contextMenu_CopyTabTitleUrl': copyToClipboard(tab.title+getEnterCode()+tab.url);  break;
  case 'contextMenu_CopyTabTitle':    copyToClipboard(tab.title);  break;
  case 'contextMenu_CopyTabUrl':      copyToClipboard(tab.url);  break;
  case 'contextMenu_CopyTabFormat':
    getStorageArea().get(defaultStorageValueSet, function(item) {
      copyToClipboard(createCopyTabFormat(tab, 1, item), item);
    });
    break;
  case 'contextMenu_CopyTabAllFormat':type++;
  case 'contextMenu_CopyTabAllUrl':   type++;
  case 'contextMenu_CopyTabAllTitle': type++;
  case 'contextMenu_CopyTabAllTitleUrl':
    onCopyTabs(type, {currentWindow:true});
    break;
  }
}

// コンテキストメニュー更新
function updateContextMenus() {
  // メニュー削除
  chrome.contextMenus.removeAll(function() {
    // ストレージ取得
    getStorageArea().get(defaultStorageValueSet, function(item) {
      // メニュー追加
      let contexts = [];
      if (item.menu_all) {  contexts.push('all'); }
      if (item.menu_page) { contexts.push('page');}
      if (item.menu_tab && isFirefox()) {
        contexts.push('tab');
      }
      
      if (contexts.length != 0) {
        [
          'CopyTabTitleUrl', 'CopyTabTitle', 'CopyTabUrl', 'CopyTabFormat', 
          'CopyTabAllTitleUrl', 'CopyTabAllTitle', 'CopyTabAllUrl', 'CopyTabAllFormat'
        ].forEach(function(v, i, a) {
          if (item['item_'+v]) {
            chrome.contextMenus.create({
              id: 'contextMenu_'+v,
              title: chrome.i18n.getMessage('contextMenu_'+v),
              contexts: contexts
            });
          }
        });
        chrome.contextMenus.onClicked.addListener(onContextMenus);
      }
    });
  });
}