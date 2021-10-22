
import { task } from "hardhat/config";
import { TaskArguments } from "hardhat/types";
import { 
    MeritDAO__factory,
    TimelockController__factory,
    MeritToken__factory,
} from "../../typechain";
import { constants } from "ethers/lib/ethers";
import { parseEther } from "ethers/lib/utils";
import sleep from "../../utils/sleep";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

const VERIFY_DELAY = 100000;
const ZERO_BYTES32 = "0x0000000000000000000000000000000000000000000000000000000000000000"

interface DAODeployment {
    token: string,
    timelock: string,
    DAO: string
}

task("deploy-token")
    .setAction(async(taskArgs, {ethers, run}) => {
        const signers = await ethers.getSigners();

        console.log("Deploying gov token");
        const token = await new MeritToken__factory(signers[0]).deploy("Merit Circle", "MC", parseEther("1000000000"));
        console.log(`Gov token deployed at: ${token.address}`);
        if(taskArgs.verify) {
            console.log("Verifying gov token, can take some time")
            await token.deployed();
            await sleep(VERIFY_DELAY);
            await run("verify:verify", {
                address: token.address,
                constructorArguments: [
                    taskArgs.tokenName,
                    taskArgs.tokenSymbol,
                    parseEther(taskArgs.initialSupply)
                ]
            })
        }
});

task("deploy-merit-dao")
    .addParam("tokenName", "name of the erc20 gov token")
    .addParam("tokenSymbol", "symbol of the erc20 gov token")
    .addParam("initialSupply", "initialSupply of the erc20 gov token")
    .addParam("daoName", "name of the DAO")
    .addParam("minDelay", "delay in blocks between creation of a proposal and voting start")
    .addParam("votingDelay", "delay in blocks between proposal and voting start")
    .addParam("votingPeriod", "seconds a proposal is open for voting")
    .addParam("quorumFraction", "quorum. 4 == 4% need to vote in favor to pass a proposal")
    .addFlag("verify")
    .setAction(async(taskArgs, { ethers, run }) => {
        const signers = await ethers.getSigners();

        console.log("Deploying gov token");
        const token = await new MeritToken__factory(signers[0]).deploy(taskArgs.tokenName, taskArgs.tokenSymbol, parseEther(taskArgs.initialSupply));
        console.log(`Gov token deployed at: ${token.address}`);
        if(taskArgs.verify) {
            console.log("Verifying gov token, can take some time")
            await token.deployed();
            await sleep(VERIFY_DELAY);
            await run("verify:verify", {
                address: token.address,
                constructorArguments: [
                    taskArgs.tokenName,
                    taskArgs.tokenSymbol,
                    parseEther(taskArgs.initialSupply)
                ]
            })
        }
        

        console.log("Deploying timelock");
        const timelock = await new TimelockController__factory(signers[0]).deploy(0, [signers[0].address], [signers[0].address]);
        console.log(`deployed timelock at: ${timelock.address}`)
        if(taskArgs.verify) {
            console.log("Verifying timelock, can take some time")
            await timelock.deployed();
            await sleep(VERIFY_DELAY);
            await run("verify:verify", {
                address: timelock.address,
                constructorArguments: [
                    0,
                    [signers[0].address],
                    [signers[0].address]
                ]
            });
        }

        console.log("Deploying DAO");
        const DAO = await new MeritDAO__factory(signers[0]).deploy(
            token.address,
            timelock.address,
            taskArgs.daoName,
            taskArgs.quorumFraction,
            taskArgs.votingDelay,
            taskArgs.votingPeriod
        );
        console.log(`DAO deployed at: ${DAO.address}`)
        if(taskArgs.verify) {
            console.log("Verifying DAO, might take some time");
            await DAO.deployed();
            await sleep(VERIFY_DELAY);
            await run("verify:verify", {
                address: DAO.address,
                constructorArguments: [
                    token.address,
                    timelock.address,
                    taskArgs.daoName,
                    taskArgs.quorumFraction,
                    taskArgs.votingDelay,
                    taskArgs.votingPeriod
                ]
            });
        }

        const deployment: DAODeployment = {
            token: token.address,
            timelock: timelock.address,
            DAO: DAO.address
        }

        console.table(deployment);
        return deployment;
});

task("set-dao-permissions")
    .setAction(async(taskArgs, { ethers }) => {
        const signers = await ethers.getSigners();

        const DAO = MeritDAO__factory.connect(taskArgs.daoAddress, signers[0]);
        const timelockAddress = await DAO.timelock();
        const timelock = await TimelockController__factory.connect(timelockAddress, signers[0]);
        const token = await MeritToken__factory.connect(await DAO.token(), signers[0]);

        const TIME_LOCK_ADMIN_ROLE = await timelock.TIMELOCK_ADMIN_ROLE();
        const PROPOSER_ROLE = await timelock.PROPOSER_ROLE();
        const EXECUTOR_ROLE = await timelock.EXECUTOR_ROLE();
        const DEFAULT_ADMIN_ROLE = await token.DEFAULT_ADMIN_ROLE();

        console.log("Setting up roles");
        // Set DAO as proposer
        await timelock.grantRole(PROPOSER_ROLE, DAO.address);
        // Allow anyone to execute
        await timelock.grantRole(EXECUTOR_ROLE, constants.AddressZero);
        
        // Set admin on token to the timelock
        token.grantRole(DEFAULT_ADMIN_ROLE, timelock.address);

        console.log("setting min delay");
        const delayData = await timelock.populateTransaction.updateDelay(taskArgs.minDelay);
        await timelock.schedule(timelock.address, 0, delayData.data as string, ZERO_BYTES32, ZERO_BYTES32, 0, {gasLimit: 5000000});
        await timelock.execute(timelock.address, 0, delayData.data as string, ZERO_BYTES32, ZERO_BYTES32, {gasLimit: 5000000});
        console.log("min delay")

        console.log("Renouncing roles");
        // Renounce timelock roles
        await timelock.renounceRole(TIME_LOCK_ADMIN_ROLE, signers[0].address);
        await timelock.renounceRole(PROPOSER_ROLE, signers[0].address);
        await timelock.renounceRole(EXECUTOR_ROLE, signers[0].address);
        // Renounce admin role on token
        await token.renounceRole(DEFAULT_ADMIN_ROLE, signers[0].address);
});