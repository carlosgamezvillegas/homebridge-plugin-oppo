function queryKeys(buttons) {
  buttons.length;
  var keys = [];
  var i = 0;
  while (i < buttons.length) {
    keys[i] = query(buttons[i]);
    i += 1;
  }
  return keys;

}

function query(qName) {
  var key;
  key = '#';
  switch (qName) {
    //POWER ButtonGroup
    case 'VERBOSE MODE':
      key += 'QVM';
      break;
    case 'POWER STATUS':
      key += 'QPW';
      break;
    case 'CURRENT RESOLUTION':
      key += 'QHD';
      break;
    case 'PLAYBACK STATUS':
      key += 'QPL';
      break;
    case 'AUDIO TYPE':
      key += 'QAT';
      break;
    case 'HDR STATUS':
      key += 'QHS';
      break;
    // case "MEDIA NAME":
    //   key += "QFN";
    // break;      
  }
  key += '\r';
  return key;
}

module.exports = { query, queryKeys };