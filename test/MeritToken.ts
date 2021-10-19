import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { MeritToken, MeritToken__factory } from "../typechain";
import hre from "hardhat";
import TimeTraveler from "../utils/TimeTraveler";
import { parseEther } from "@ethersproject/units";


const NAME = "NAME";
const SYMBOL = "SYMBOL";
const INITIAL_SUPPLY = parseEther("10000");

describe("MeritToken", function() {

    this.timeout(200000);

    let meritToken: MeritToken;
    let deployer: SignerWithAddress;
    let minter: SignerWithAddress;
    let burner: SignerWithAddress;
    let accounts: SignerWithAddress[];
    const timeTraveler = new TimeTraveler(hre.network.provider);

    before(async() => {
        [deployer, minter, burner, ...accounts] = await hre.ethers.getSigners();
        meritToken = await (new MeritToken__factory(deployer)).deploy(NAME, SYMBOL, INITIAL_SUPPLY);

        const MINTER_ROLE = await meritToken.MINTER_ROLE();
        const BURNER_ROLE = await meritToken.BURNER_ROLE();

        await meritToken.grantRole(MINTER_ROLE, minter.address);
        await meritToken.grantRole(BURNER_ROLE, burner.address);

        await timeTraveler.snapshot();
    });

    beforeEach(async() => {
        await timeTraveler.revertSnapshot();
    });

    describe("contructor", async() => {
        it("Constructor args should be used", async() => {
            const name = await meritToken.name();
            const symbol = await meritToken.symbol();
            const totalSupply = await meritToken.totalSupply();
            const deployerBalance = await meritToken.balanceOf(deployer.address);

            expect(name).to.eq(NAME);
            expect(symbol).to.eq(SYMBOL);
            expect(totalSupply).to.eq(INITIAL_SUPPLY);
            expect(deployerBalance).to.eq(INITIAL_SUPPLY);
        });
        it("Should assign DEFAULT_ADMIN_ROLE to deployer", async() => {
            const DEFAULT_ADMIN_ROLE = await meritToken.DEFAULT_ADMIN_ROLE();
            const hasRole = await meritToken.hasRole(DEFAULT_ADMIN_ROLE, deployer.address);
            expect(hasRole).to.eq(true);
        });
    });
    describe("mint", async() => {
        it("Should work when calling from address which has MINTER_ROLE", async() => {
            const MINT_AMOUNT = parseEther("10");
            await meritToken.connect(minter).mint(accounts[0].address, MINT_AMOUNT);

            const totalSupply = await meritToken.totalSupply();
            const accountBalance = await meritToken.balanceOf(accounts[0].address);

            expect(totalSupply).to.eq(INITIAL_SUPPLY.add(MINT_AMOUNT));
            expect(accountBalance).to.eq(MINT_AMOUNT);
        });
        it("Should revert when called from address without MINTER_ROLE", async() => {
            await expect(meritToken.mint(accounts[0].address, parseEther("1"))).to.be.revertedWith("MeritToken.onlyHasRole: msg.sender does not have role");
        });
    });
    describe("burn", async() => {
        it("Should work when calling from address which has BURNER_ROLE", async() => {
            const BURN_AMOUNT = parseEther("1");
            await meritToken.connect(burner).burn(deployer.address, BURN_AMOUNT);

            const totalSupply = await meritToken.totalSupply();
            const accountBalance = await meritToken.balanceOf(deployer.address);

            expect(totalSupply).to.eq(INITIAL_SUPPLY.sub(BURN_AMOUNT));
            expect(accountBalance).to.eq(INITIAL_SUPPLY.sub(BURN_AMOUNT));
        });
        it("Should revert when called from address without BURNER_ROLE", async() => {
            await expect(meritToken.burn(accounts[0].address, parseEther("1"))).to.revertedWith("MeritToken.onlyHasRole: msg.sender does not have role");
        });
    });

    describe("transfer", async() => {
        it("transfer to token contract should fail", async() => {
            await expect(meritToken.transfer(meritToken.address, parseEther("1"))).to.be.revertedWith("MeritToken._transfer: transfer to self not allowed");
        });
        it("transfer should work normally", async() => {
            const TRANSFER_AMOUNT = parseEther("1");
            await meritToken.transfer(accounts[0].address, TRANSFER_AMOUNT);

            const fromBalance = await meritToken.balanceOf(deployer.address);
            const toBalance = await meritToken.balanceOf(accounts[0].address);

            expect(fromBalance).to.eq(INITIAL_SUPPLY.sub(TRANSFER_AMOUNT));
            expect(toBalance).to.eq(TRANSFER_AMOUNT);
        });
    });
});