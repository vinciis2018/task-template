const { namespaceWrapper } = require("./namespaceWrapper");
// const crypto = require('crypto');
const mongoose = require('mongoose');
const fs = require('fs');

const { Web3Storage, getFilesFromPath } = require('web3.storage');
// Create new client
const storageClient = new Web3Storage({ token: process.env.WEB3_STORAGE_KEY });
class CoreLogic{

async task() {
  // Write the logic to do the work required for submitting the values and optionally store the result in levelDB
  
  // Below is just a sample of work that a task can do

  try{
  
    const url = process.env.DB_URL;

    mongoose.set("strictQuery", true);
    mongoose.connect(url, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      retryWrites: true,
      w: "majority",
    });

    const playingDataSchema = new mongoose.Schema(
      {
        deviceInfo: { type: String },
        playTime: { type: Date },
        playVideo: { type: String },
      }, {
        timestamps: true,
      }
    );
    const screenLogsSchema = new mongoose.Schema(
      {
        screen: { type: mongoose.Schema.Types.ObjectId, ref: "Screen" },
        playingDetails: [playingDataSchema]
      },
      {
        timestamps: true,
      }
    );

    const ScreenLogs = mongoose.model("ScreenLogs", screenLogsSchema);

    const logs = await ScreenLogs.find();
    // console.log(logs);
    const logsJson = JSON.stringify(logs);
    const signedJson = await namespaceWrapper.signData(logsJson);
    
    fs.writeFileSync("screenLogs.json", signedJson);

    if (storageClient) {
      // Storing on IPFS through web3 storage as example
      const file = await getFilesFromPath("./qod.json");
      const cid = await storageClient.put(file);
      console.log("CID of Uploaded Data: ", cid);
      
      await namespaceWrapper.checkSubmissionAndUpdateRound(cid);
      if (cid) {
        await namespaceWrapper.storeSet("cid", cid); // store CID in levelDB
      }
    } else {
      console.error("No web3 storage API key provided");
    }

  // const x = Math.random().toString(); // generate random number and convert to string
  // const cid = crypto.createHash("sha1").update(x).digest("hex"); // convert to CID
  // console.log("HASH:", cid);

  // // fetching round number to store work accordingly

  // if (cid) {
  //   await namespaceWrapper.storeSet("cid", cid); // store CID in levelDB
  // }
}catch(err){
  console.log("ERROR IN EXECUTING TASK", err);
}
  
}
async fetchSubmission(){
  // Write the logic to fetch the submission values here and return the cid string

  // fetching round number to store work accordingly

  console.log("IN FETCH SUBMISSION");

  const round = await namespaceWrapper.getRound();
  // The code below shows how you can fetch your stored value from level DB

  const cid = await namespaceWrapper.storeGet("cid"); // retrieves the cid
  console.log("CID", cid);
  return cid;
}

async generateDistributionList(round){
  try{
  console.log("GenerateDistributionList called");
  console.log("I am selected node");

  // Write the logic to generate the distribution list here by introducing the rules of your choice


  /*  **** SAMPLE LOGIC FOR GENERATING DISTRIBUTION LIST ******/
  
  let distributionList = {};
    const taskAccountDataJSON = await namespaceWrapper.getTaskState();
    const submissions = taskAccountDataJSON.submissions[round];
    const submissions_audit_trigger =
                  taskAccountDataJSON.submissions_audit_trigger[round];
    if (submissions == null) {
      console.log("No submisssions found in N-2 round");
      return distributionList;
    } else {
      const keys = Object.keys(submissions);
      const values = Object.values(submissions);
      const size = values.length;
      console.log("Submissions from last round: ", keys, values, size);
      for (let i = 0; i < size; i++) {
        const candidatePublicKey = keys[i];
        if (submissions_audit_trigger && submissions_audit_trigger[candidatePublicKey]) {
          console.log(submissions_audit_trigger[candidatePublicKey].votes, "distributions_audit_trigger votes ");
          const votes = submissions_audit_trigger[candidatePublicKey].votes;
          let numOfVotes = 0;
          for (let index = 0; index < votes.length; index++) {
            if(votes[i].is_valid)
              numOfVotes++;
            else numOfVotes--;
          }
          if(numOfVotes < 0)
            continue;
        }
        distributionList[candidatePublicKey] = 1;  
      }
    }
    console.log("Distribution List", distributionList);
    return  distributionList;  
  }catch(err){
    console.log("ERROR IN GENERATING DISTRIBUTION LIST", err);
  }
}


async submitDistributionList(round) {

// This function just upload your generated dustribution List and do the transaction for that 

  console.log("SubmitDistributionList called");

  try{
  
    const distributionList = await this.generateDistributionList(round);
    
    const decider = await namespaceWrapper.uploadDistributionList(
      distributionList, round
    );
    console.log("DECIDER", decider);
  
    if (decider) {
      const response = await namespaceWrapper.distributionListSubmissionOnChain(round);
      console.log("RESPONSE FROM DISTRIBUTION LIST", response);
    }
  }catch(err){
    console.log("ERROR IN SUBMIT DISTRIBUTION", err);
  }
}


async validateNode(submission_value, round) {
  
// Write your logic for the validation of submission value here and return a boolean value in response

// The sample logic can be something like mentioned below to validate the submission

// try{

console.log("Received submission_value", submission_value, round);
// const generatedValue = await namespaceWrapper.storeGet("cid");
// console.log("GENERATED VALUE", generatedValue);
// if(generatedValue == submission_value){
//   return true;
// }else{
//   return false;
// }
// }catch(err){
//   console.log("ERROR  IN VALDIATION", err);
//   return false;
// }

// For succesfull flow we return true for now 
return true;
}


async shallowEqual(object1, object2) {
  const keys1 = Object.keys(object1);
  const keys2 = Object.keys(object2);
  if (keys1.length !== keys2.length) {
    return false;
  }
  for (let key of keys1) {
    if (object1[key] !== object2[key]) {
      return false;
    }
  }
  return true;
}

validateDistribution = async(distributionListSubmitter, round) => {

// Write your logic for the validation of submission value here and return a boolean value in response
// this logic can be same as generation of distribution list function and based on the comparision will final object , decision can be made

try{
  console.log("Distribution list Submitter", distributionListSubmitter);
  const fetchedDistributionList = JSON.parse(await namespaceWrapper.getDistributionList(distributionListSubmitter,round));
  console.log("FETCHED DISTRIBUTION LIST",fetchedDistributionList);
  const generateDistributionList = await this.generateDistributionList(round);

  // compare distribution list 

  const parsed = JSON.parse(fetchedDistributionList);
  const result = await this.shallowEqual(parsed,generateDistributionList);
  console.log("RESULT", result);
  return result;
}catch(err){
  console.log("ERROR IN VALIDATING DISTRIBUTION", err);
  return false;

}

}
// Submit Address with distributioon list to K2
async submitTask(roundNumber) {
  console.log("submitTask called with round", roundNumber);
  try {
    console.log("inside try");
    console.log(await namespaceWrapper.getSlot(), "current slot while calling submit");
    const submission = await this.fetchSubmission();
    console.log("SUBMISSION", submission);
    await namespaceWrapper.checkSubmissionAndUpdateRound(submission, roundNumber);
    console.log("after the submission call");
  } catch (error) {
    console.log("error in submission", error);
  }
}

async auditTask(roundNumber) {
  console.log("auditTask called with round", roundNumber);
  console.log(await namespaceWrapper.getSlot(), "current slot while calling auditTask");
  await namespaceWrapper.validateAndVoteOnNodes(this.validateNode, roundNumber);
}

async auditDistribution(roundNumber) {
  console.log("auditDistribution called with round", roundNumber);
  await namespaceWrapper.validateAndVoteOnDistributionList(this.validateDistribution, roundNumber);
}

}
const coreLogic = new CoreLogic();

module.exports = {
  coreLogic
};