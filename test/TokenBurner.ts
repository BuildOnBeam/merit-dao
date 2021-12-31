import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { 
    MeritToken,
    MeritToken__factory,
    TokenBurner,
    TokenBurner__factory
} from "../typechain";
import hre from "hardhat";
import TimeTraveler from "../utils/TimeTraveler";
import { parseEther } from "@ethersproject/units";


const NAME = "NAME";
const SYMBOL = "SYMBOL";
const INITIAL_SUPPLY = parseEther("10000");
const BURN_AMOUNT = parseEther("100");

describe("TokenBurner", function() {

    this.timeout(200000);

    let meritToken: MeritToken;
    let tokenBurner: TokenBurner;
    let deployer: SignerWithAddress;
    let accounts: SignerWithAddress[];
    const timeTraveler = new TimeTraveler(hre.network.provider);

    before(async() => {
        [deployer, ...accounts] = await hre.ethers.getSigners();
        meritToken = await (new MeritToken__factory(deployer)).deploy(NAME, SYMBOL, INITIAL_SUPPLY);

        const MINTER_ROLE = await meritToken.MINTER_ROLE();
        const BURNER_ROLE = await meritToken.BURNER_ROLE();

        tokenBurner = await (new TokenBurner__factory(deployer)).deploy(meritToken.address);

        // allow tokenBurner to burn tokens
        await meritToken.grantRole(BURNER_ROLE, tokenBurner.address);

        await timeTraveler.snapshot();
    });

    beforeEach(async() => {
        await timeTraveler.revertSnapshot();
    });

    it("Burn should work", async() => {
        // Transfer some tokens into the burner
        meritToken.transfer(tokenBurner.address, BURN_AMOUNT);

        const totalSupplyBefore = await meritToken.totalSupply();
        await tokenBurner.burn();
        const totalSupplyAfter = await meritToken.totalSupply();
        const burnerBalance = await meritToken.balanceOf(tokenBurner.address);

        expect(totalSupplyAfter).to.eq(totalSupplyBefore.sub(BURN_AMOUNT));
        expect(burnerBalance).to.eq(0);
    });

});