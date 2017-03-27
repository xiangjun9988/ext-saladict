import {storage, message} from 'src/helpers/chrome-api'
import defaultConfig from 'src/app-config'

// background script as transfer station
message.listen((data, sender, sendResponse) => {
  if (data.self) {
    message.send(sender.tab.id, data, response => {
      sendResponse(response)
    })
  }
  return true
})

const _dicts = {}
// dynamic load components
const _compReq = require.context('./dicts', true, /\.js$/i)
const _idChecker = /\/(\S+)\.js$/i
_compReq.keys().forEach(path => {
  let id = _idChecker.exec(path)
  if (!id) { return }
  id = id[1].toLowerCase()

  let search = _compReq(path)
  if (typeof search !== 'function') {
    search = search.default
  }
  _dicts[id] = {
    search,
    config: JSON.parse(JSON.stringify(defaultConfig))
  }
})

function setConfigs (config) {
  Object.keys(_dicts).forEach(id => {
    _dicts[id].config = JSON.parse(JSON.stringify(defaultConfig))
  })
}

storage.sync.get('config', data => {
  if (data.config) {
    setConfigs(data.config)
  }
})

storage.listen('config', changes => {
  setConfigs(changes.config.newValue)
})

message.on('SEARCH_TEXT', (data, sender, sendResponse) => {
  let dict = _dicts[data.dict]
  if (!dict) {
    sendResponse({error: 'Missing Dictionary!'})
    return
  }

  function handleSuccess (result) {
    sendResponse({result, dict: data.dict})
  }

  function handleError (error) {
    sendResponse({error, dict: data.dict})
  }

  dict.search(data.text, dict.config)
    .then(handleSuccess, handleError)
    .catch(handleError)

  // keep the channel alive
  return true
})

// merge config on installed
chrome.runtime.onInstalled.addListener(({previousVersion}) => {
  let config = defaultConfig
  let [major, minor, patch] = previousVersion.split('.').map(n => Number(n))
  if (major <= 4) {
    storage.local.clear()
    storage.sync.clear()
      .then(() => {
        storage.sync.set({config})
        setConfigs(config)
      })
  }
})