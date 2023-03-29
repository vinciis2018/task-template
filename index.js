const {coreLogic} = require("./coreLogic");
const { app } = require("./init");
const { namespaceWrapper } = require("./namespaceWrapper");
const axios = require("axios");
const { Web3Storage } = require('web3.storage');
const client = new Web3Storage({ token: process.env.SECRET_WEB3_STORAGE });

async function setup() {
  console.log("setup function called");
  // Run default setup
  await namespaceWrapper.defaultTaskSetup();
  process.on("message", (m) => {
    console.log("CHILD got message:", m);
    if (m.functionCall == "submitPayload") {
      console.log("submitPayload called");
      coreLogic.submitTask(m.roundNumber);
    } else if (m.functionCall == "auditPayload") {
      console.log("auditPayload called");
      coreLogic.auditTask(m.roundNumber);
    }
    else if(m.functionCall == "executeTask") {
      console.log("executeTask called");
      coreLogic.task();
    }
    else if(m.functionCall == "generateAndSubmitDistributionList") {
      console.log("generateAndSubmitDistributionList called");
      coreLogic.submitDistributionList(m.roundNumber);
    }
    else if(m.functionCall == "distributionListAudit") {
      console.log("distributionListAudit called");
      coreLogic.auditDistribution(m.roundNumber);
    }
  });


  /* GUIDE TO CALLS K2 FUNCTIONS MANUALLY

  If you wish to do the development by avoiding the timers then you can do the intended calls to K2 
  directly using these function calls. 

  To disable timers please set the TIMERS flag in task-node ENV to disable

  NOTE : K2 will still have the windows to accept the submission value, audit, so you are expected
  to make calls in the intended slots of your round time. 

  */

  // Get the task state 
  //console.log(await namespaceWrapper.getTaskState());

  //GET ROUND 

  // const round = await namespaceWrapper.getRound();
  // console.log("ROUND", round);


  // Call to do the work for the task

  await coreLogic.task();

  // Submission to K2 (Preferablly you should submit the cid received from IPFS)


  //  await coreLogic.submitTask(round - 1);

  // Audit submissions 

  //await coreLogic.auditTask(round - 1);

  // upload distribution list to K2

  //await coreLogic.submitDistributionList(round - 2)

  // Audit distribution list

  //await coreLogic.auditDistribution(round - 2);

  // Payout trigger

  // const responsePayout = await namespaceWrapper.payoutTrigger();
  // console.log("RESPONSE TRIGGER", responsePayout);






}

setup();

if (app) {
  //  Write your Express Endpoints here.
  //  For Example
  //  app.post('/accept-cid', async (req, res) => {})

  // Sample API that return your task state 
  // https:localhost:8080/task/:taskid/taskState
  app.get('/taskState', async (req, res) => {
    const state = await namespaceWrapper.getTaskState();
    console.log("TASK STATE", state);

    res.status(200).json({ taskState: state })
  })

  app.get('/getCidData', async (req, res) => {
    const cid1 = await namespaceWrapper.storeGet("cid");
    console.log("API CALLED CID", cid1)
    const resp = await client.get(cid1); // Web3Response
    const files = await resp.files(); // Web3File[]
    console.log("files", files)

    for (const file of files) {
      console.log(`${file.cid} ${file.name} ${file.size}`);
      const data = await axios.get(`https://ipfs.io/ipfs/${file.cid}`);
      res.status(200).json({data: data.data})
    }
    
  })
}

