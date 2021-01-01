function pressedButton(name) {
  var key;
  key = '#';

  switch (name) {
    //POWER ButtonGroup
    case 'POWER ON':
      key += 'PON';
      break;
    case 'POWER OFF':
      key += 'POF';
      break;
    case 'VERBOSE MODE 2':
      key += 'SVM 2';
      break;
    //Controlpad ButtonGroup
    case 'CURSOR UP':
      key += 'NUP';
      break;
    case 'CURSOR DOWN':
      key += 'NDN';
      break;
    case 'CURSOR LEFT':
      key += 'NLT';
      break;
    case 'CURSOR RIGHT':
      key += 'NRT';
      break;
    case 'CURSOR ENTER':
      key += 'SEL';
      break;
    //Menu and Back ButtonGroup
    case 'MENU':
      key += 'MNU';
      break;
    case 'BACK':
      key += 'RET';
      break;
    //Transport ButtonGroup
    case 'PLAY':
      key += 'PLA';
      break;
    case 'PAUSE':
      key += 'PAU';
      break;
    case 'STOP':
      key += 'STP';
      break;
    //Transport Scan ButtonGroup
    case 'PREVIOUS':
      key += 'PRE';
      break;
    case 'NEXT':
      key += 'NXT';
      break;

    case 'CLEAR':
      key += 'CLR';
      break;

    case 'TOP MENU':
      key += 'TTL';
      break;
    case 'OPTION':
      key += 'OPT';
      break;

    case 'HOME MENU':
      key += 'HOM';
      break;


    case 'INFO':
      key += 'OSD';
      break;
    case 'SETUP':
      key += 'SET';
      break;

    case 'REWIND':
      key += 'REV';
      break;

    case 'FORWAD':
      key += 'FWD';
      break;
  

  }

  key += '\r';
  return key;
}
module.exports = { pressedButton };