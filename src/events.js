function eventDecoder(dataReceived) {
  const update = require('./index.ts');
  const console = require('console');
  const query = require('./query.js');
  var str = (`${dataReceived}`);
  var res = str.split('@');

  var i = 0;
  console.log(res);


  while (i < res.length) {
    if (res[i] === '') {
      console.log('hello1');
    } else if (res[i].includes('QPW OK OFF')) {
      update.newPowerState(false);
      update.newPlayBackState([false, false, false]);
      update.newHDRState([false, false, false]);
    } else if (res[i].includes('POF OK OFF')) {
      console.log('power off');
      update.newPowerState(false);
      update.newPlayBackState([false, false, false]);
      update.newHDRState([false, false, false]);
    } else if (res[i].includes('PON OK')) {
      update.newPowerState(true);
    } else if (res[i].includes('QPW OK ON')) {
      update.newPowerState(true);
    } else if (res[i].includes('OK PLAY')) {
      update.newPlayBackState([true, false, false]);

    } else if (res[i].includes('OK PAUSE')) {
      update.newPlayBackState([false, true, false]);

    } else if (res[i].includes('OK STOP')) {
      update.newPlayBackState([false, false, true]);

    } else if (res[i].includes('OK STEP')) {
      update.newPlayBackState([false, false, false]);

    } else if (res[i].includes('OK FREV')) {
      update.newPlayBackState([false, false, false]);

    } else if (res[i].includes('OK FFWD')) {
      update.newPlayBackState([false, false, false]);

      

    } else if (res[i].includes('OK SCREEN')) {
      update.newPlayBackState([false, false, false]);

      

    } else if (res[i].includes('OK SFWD')) {
      update.newPlayBackState([false, false, false]);

    } else if (res[i].includes('OK SREV')) {
      update.newPlayBackState([false, false, false]);

    }
    ///Video Type
    else if (res[i].includes('OK HDR')) {
      update.newHDRState([false, true, false]);

    } else if (res[i].includes('OK SDR')) {

      update.newHDRState([false, false, true]);
    } else if (res[i].includes('OK DOV')) {

      update.newHDRState([true, false, false]);
    }

    //unsolicited events
    else if (res[i].includes('UPW 1')) {
      update.newPowerState(true);

    } else if (res[i].includes('UPW 0')) {
      update.newPowerState(false);
      update.newPlayBackState([false, false, false]);
      update.newHDRState([false, false, false]);

    } else if (res[i].includes('UPL PLAY')) {
      update.newPlayBackState([true, false, false]);

    } else if (res[i].includes('UPL PAUS')) {
      update.newPlayBackState([false, true, false]);

    } else if (res[i].includes('UPL STOP')) {
      update.newPlayBackState([false, false, true]);

    } else if (res[i].includes('UPL STPF')) {
      update.newPlayBackState([false, false, false]);

    } else if (res[i].includes('UPL STPR')) {
      update.newPlayBackState([false, false, false]);

    } else if (res[i].includes('UPL FFW1')) {
      update.newPlayBackState([false, false, false]);

    } else if (res[i].includes('UPL FRV1')) {

      update.newPlayBackState([false, false, false]);
    } else if (res[i].includes('UPL SFW1')) {
      update.newPlayBackState([false, false, false]);

    } else if (res[i].includes('UPL SRV1')) {
      update.newPlayBackState([false, false, false]);

    } else if (res[i].includes('UPL HOME')) {
      update.newPowerState(false);
      update.newPlayBackState([false, false, false]);
      update.newHDRState([false, false, false]);

    } else if (res[i].includes('UPL MCTR')) {
      update.newPlayBackState([false, false, false]);

    } else if (res[i].includes('UPL SCSV')) {
      update.newPlayBackState([false, false, false]);

    } else if (res[i].includes('UPL MENUP')) {
      update.newPlayBackState([false, false, false]);

    } else if (res[i].includes('UAT')) {
      update.sending(query.query('HDR STATUS'));

    } else if (res[i].includes('U3D 2D')) {
      update.sending(query.query('HDR STATUS'));
      update.sending(query.query('PLAYBACK STATUS'));
    }

  

    /*

 
    else if(res[i]=="OK 1080I60")){


    }


else if(res[i]=="OK 1080P60")){

        
    }
    else if(res[i]=="OK 1080PAUTO")){

        
    }
    else if(res[i]=="OK UHD24")){

        
    }
    else if(res[i]=="OK UHD60")){

        
    }
    else if(res[i]=="OK UHD_AUTO")){

        
    }
    else if(res[i]=="OK AUTO")){

        
    }
    */


    /*
   
    else if(res[i]=="OK DD 1/1")){

        
    }
    else if(res[i]=="OK DD 1/5 English")){

        
    }
    else if(res[i]=="OK LPCM")){

        
    }

    */






    /*/ UAT DD 01/05 ENG 5.1
    else if(res[i]=="UAT D")){

        
    }   
    else if(res[i]=="UAT DD")){

        
    }

    else if(res[i]=="UAT DP")){

        
    } 
    else if(res[i]=="UAT DT")){

        
    } 
    else if(res[i]=="UAT TS")){

        
    } 
    else if(res[i]=="UAT TH")){

        
    }
    else if(res[i]=="UAT TM")){

        
    } 
    else if(res[i]=="UAT PC")){

        
    } 
    else if(res[i]=="UAT MP")){

        
    } 
    else if(res[i]=="UAT CD")){

        
    } 
    else if(res[i]=="UAT UN")){

        
    } 


   */
    else {}

    i += 1;

  }


}

// eslint-disable-next-line no-undef
module.exports = { eventDecoder };