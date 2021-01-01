function updateAll(){
  const query = require('./query.js');
  let queryAll=['POWER STATUS', 'PLAYBACK STATUS', 'HDR STATUS'];
  let KEYS=query.queryKeys(queryAll);
  return KEYS;
}

function updatePlayback(){
  const query = require('./query.js');
  let queryPlayback=['PLAYBACK STATUS'];
  let KEYS=query.queryKeys(queryPlayback);
  return KEYS;
     
}

function updateHDRStatus(){
  const query = require('./query.js');
  let queryHDR=['HDR STATUS'];
  let KEYS=query.queryKeys(queryHDR);
  return KEYS;
}

function turnOffAll(){
  const update = require('./index.js');
  update.newPowerState(false);
  update.newHDRState([false, false, false]);
  update.newPlayBackState([false, false, false]);


}




function startUptStatus(){

  
  key=query.query('POWER STATUS');
    
  client = new net.Socket()
    .on('data', function(data) {
      clearTimeout(timer);
      this.log.debug(`[oppo-udp-20x] [Response] ${data}`);
      var str = (`${data}`);
      return str;
    
      client.destroy(); // kill client after server's response
    })
    .on('error', function(e) {
      clearTimeout(timer);
      this.log.debug(`[oppo-udp-20x] [Error] ${e}`);
    })
    .connect(OPPO_PORT, OPPO_IP, function(){
      clearTimeout(timer);
      this.log.debug(`[oppo-udp-20x] [Sending] ${JSON.stringify(key)}`);
      client.write(key);
      
    
    });
    
  timer = setTimeout(function() {
    this.log.debug('[ERROR] Attempt at connection exceeded timeout value');
    device.clientSocket.end();
  }, timeout);
    
}

module.exports = { startUptStatus, updateAll, updatePlayback, turnOffAll, updateHDRStatus };