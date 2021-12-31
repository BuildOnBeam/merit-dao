import { task } from "hardhat/config";
import { TaskArguments } from "hardhat/types";
import { 
    TokenBurner__factory
} from "../../typechain";
import { constants } from "ethers/lib/ethers";
import { parseEther } from "ethers/lib/utils";
import sleep from "../../utils/sleep";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

const VERIFY_DELAY = 100000;

task("deploy-token-burner")
    .addParam("token")
    .addFlag("verify")
    .setAction(async(taskArgs, { ethers, run }) => {
        const signers = await ethers.getSigners();

        console.log("Deploying token burner");
        const tokenBurner = await new TokenBurner__factory(signers[0]).deploy(taskArgs.token);
        console.log(`Burner deployed at: ${tokenBurner.address}`);

        if(taskArgs.verify) {
            console.log("Verifying tokenBurner, can take some time")
            await tokenBurner.deployed();
            await sleep(VERIFY_DELAY);
            await run("verify:verify", {
                address: tokenBurner.address,
                constructorArguments: [
                    taskArgs.token
                ]
            })
        }

        console.log("done");
});