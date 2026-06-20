import { loadFixture, time } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { ethers } from "hardhat";
import { expect } from "chai";
import { deployOracleFixture } from "./helpers/deploy";
import { signScore } from "./helpers/signScore";
import { tierFromScore } from "./helpers/constants";

const ONE_HOUR = 3_600n;

describe("CrediFiOracle", () => {
  describe("constructor", () => {
    it("stores the configured signer", async () => {
      const { oracle, backendSigner } = await loadFixture(deployOracleFixture);
      expect(await oracle.getFunction("signer")()).to.equal(await backendSigner.getAddress());
    });

    it("reverts when signer is the zero address", async () => {
      const signers = await ethers.getSigners();
      const Oracle = await ethers.getContractFactory("CrediFiOracle");
      await expect(Oracle.connect(signers[0]).deploy(ethers.ZeroAddress)).to.be.revertedWithCustomError(
        Oracle,
        "Oracle__ZeroSigner",
      );
    });
  });

  describe("submitScore", () => {
    it("accepts a valid signature from the configured signer", async () => {
      const { oracle, backendSigner, otherSigners } = await loadFixture(deployOracleFixture);
      const wallet = await otherSigners[0].getAddress();
      const chainId = (await ethers.provider.getNetwork()).chainId;
      const expiresAt = (await time.latest()) + Number(ONE_HOUR);
      const sig = await signScore(backendSigner, await oracle.getAddress(), chainId, {
        wallet, score: 820, tier: tierFromScore(820), expiresAt, nonce: 1n,
      });

      await expect(oracle.connect(backendSigner).submitScore(
        wallet, 820, tierFromScore(820), expiresAt, 1n, sig.v, sig.r, sig.s,
      )).to.emit(oracle, "ScoreSubmitted").withArgs(wallet, 820, tierFromScore(820), expiresAt, 1n);

      const stored = await oracle.scores(wallet);
      expect(stored.score).to.equal(820);
      expect(stored.tier).to.equal(tierFromScore(820));
      expect(stored.nonce).to.equal(1n);
    });

    it("reverts when called by a non-signer", async () => {
      const { oracle, otherSigners } = await loadFixture(deployOracleFixture);
      const wallet = await otherSigners[0].getAddress();
      const chainId = (await ethers.provider.getNetwork()).chainId;
      const expiresAt = (await time.latest()) + Number(ONE_HOUR);
      // Sign with a non-signer to get a valid-shape but wrong-signer signature.
      const sig = await signScore(otherSigners[1], await oracle.getAddress(), chainId, {
        wallet, score: 820, tier: 1, expiresAt, nonce: 1n,
      });
      await expect(oracle.connect(otherSigners[1]).submitScore(
        wallet, 820, 1, expiresAt, 1n, sig.v, sig.r, sig.s,
      )).to.be.revertedWithCustomError(oracle, "Oracle__UnauthorizedSigner");
    });

    it("reverts when the signature has expired", async () => {
      const { oracle, backendSigner, otherSigners } = await loadFixture(deployOracleFixture);
      const wallet = await otherSigners[0].getAddress();
      const chainId = (await ethers.provider.getNetwork()).chainId;
      const expiresAt = (await time.latest()) + 60;
      const sig = await signScore(backendSigner, await oracle.getAddress(), chainId, {
        wallet, score: 820, tier: 1, expiresAt, nonce: 1n,
      });
      // Advance time past the expiry.
      await time.increase(120);
      await expect(oracle.connect(backendSigner).submitScore(
        wallet, 820, 1, expiresAt, 1n, sig.v, sig.r, sig.s,
      )).to.be.revertedWithCustomError(oracle, "Oracle__Expired");
    });

    it("reverts when score exceeds SCORE_MAX", async () => {
      const { oracle, backendSigner, otherSigners } = await loadFixture(deployOracleFixture);
      const wallet = await otherSigners[0].getAddress();
      const chainId = (await ethers.provider.getNetwork()).chainId;
      const expiresAt = (await time.latest()) + Number(ONE_HOUR);
      const sig = await signScore(backendSigner, await oracle.getAddress(), chainId, {
        wallet, score: 1001, tier: 1, expiresAt, nonce: 1n,
      });
      await expect(oracle.connect(backendSigner).submitScore(
        wallet, 1001, 1, expiresAt, 1n, sig.v, sig.r, sig.s,
      )).to.be.revertedWithCustomError(oracle, "Oracle__ScoreOutOfRange");
    });

    it("reverts on a replayed nonce", async () => {
      const { oracle, backendSigner, otherSigners } = await loadFixture(deployOracleFixture);
      const wallet = await otherSigners[0].getAddress();
      const chainId = (await ethers.provider.getNetwork()).chainId;
      const expiresAt = (await time.latest()) + Number(ONE_HOUR);
      const sig = await signScore(backendSigner, await oracle.getAddress(), chainId, {
        wallet, score: 820, tier: 1, expiresAt, nonce: 1n,
      });
      await oracle.connect(backendSigner).submitScore(wallet, 820, 1, expiresAt, 1n, sig.v, sig.r, sig.s);
      await expect(oracle.connect(backendSigner).submitScore(
        wallet, 820, 1, expiresAt, 1n, sig.v, sig.r, sig.s,
      )).to.be.revertedWithCustomError(oracle, "Oracle__StaleNonce");
    });

    it("accepts a higher nonce after a lower one was consumed", async () => {
      const { oracle, backendSigner, otherSigners } = await loadFixture(deployOracleFixture);
      const wallet = await otherSigners[0].getAddress();
      const chainId = (await ethers.provider.getNetwork()).chainId;
      const expiresAt = (await time.latest()) + Number(ONE_HOUR);
      const sig1 = await signScore(backendSigner, await oracle.getAddress(), chainId, {
        wallet, score: 820, tier: 1, expiresAt, nonce: 1n,
      });
      const sig2 = await signScore(backendSigner, await oracle.getAddress(), chainId, {
        wallet, score: 700, tier: 2, expiresAt, nonce: 2n,
      });
      await oracle.connect(backendSigner).submitScore(wallet, 820, 1, expiresAt, 1n, sig1.v, sig1.r, sig1.s);
      await oracle.connect(backendSigner).submitScore(wallet, 700, 2, expiresAt, 2n, sig2.v, sig2.r, sig2.s);
      const stored = await oracle.scores(wallet);
      expect(stored.score).to.equal(700);
      expect(stored.tier).to.equal(2);
    });

    it("reverts when supplied tier disagrees with recomputed tier", async () => {
      const { oracle, backendSigner, otherSigners } = await loadFixture(deployOracleFixture);
      const wallet = await otherSigners[0].getAddress();
      const chainId = (await ethers.provider.getNetwork()).chainId;
      const expiresAt = (await time.latest()) + Number(ONE_HOUR);
      // Sign score=799 (which is tier 2 / B) but submit with tier=1 (A).
      const sig = await signScore(backendSigner, await oracle.getAddress(), chainId, {
        wallet, score: 799, tier: 1, expiresAt, nonce: 1n,
      });
      await expect(oracle.connect(backendSigner).submitScore(
        wallet, 799, 1, expiresAt, 1n, sig.v, sig.r, sig.s,
      )).to.be.revertedWithCustomError(oracle, "Oracle__InvalidTier");
    });

    it("exposes the EIP-712 domain via eip712Domain() (EIP-5267)", async () => {
      const { oracle } = await loadFixture(deployOracleFixture);
      const chainId = (await ethers.provider.getNetwork()).chainId;
      const domain = await oracle.eip712Domain();
      // OZ v5 EIP712 returns (fields, name, version, chainId, verifyingContract, salt, extensions).
      expect(domain.fields).to.equal("0x0f");
      expect(domain.name).to.equal("CrediFiOracle");
      expect(domain.version).to.equal("1");
      expect(domain.chainId).to.equal(chainId);
      expect(domain.verifyingContract).to.equal(await oracle.getAddress());
    });

    it("setSigner is only callable by the owner", async () => {
      const { oracle, otherSigners, owner } = await loadFixture(deployOracleFixture);
      await expect(oracle.connect(otherSigners[0]).setSigner(await otherSigners[1].getAddress()))
        .to.be.revertedWithCustomError(oracle, "OwnableUnauthorizedAccount");
      await expect(oracle.connect(owner).setSigner(await otherSigners[1].getAddress()))
        .to.emit(oracle, "SignerUpdated");
    });

    it("verifyScore is a pure view (no state writes)", async () => {
      const { oracle, backendSigner, otherSigners } = await loadFixture(deployOracleFixture);
      const wallet = await otherSigners[0].getAddress();
      const chainId = (await ethers.provider.getNetwork()).chainId;
      const expiresAt = (await time.latest()) + Number(ONE_HOUR);
      const sig = await signScore(backendSigner, await oracle.getAddress(), chainId, {
        wallet, score: 820, tier: 1, expiresAt, nonce: 1n,
      });

      const before = await oracle.scores(wallet);
      const ok = await oracle.verifyScore.staticCall(wallet, 820, 1, expiresAt, 1n, sig.v, sig.r, sig.s);
      const after = await oracle.scores(wallet);
      expect(ok[0]).to.equal(true);
      expect(after.nonce).to.equal(before.nonce); // unchanged
    });

    it("verifyScore returns false for a tampered signature", async () => {
      const { oracle, backendSigner, otherSigners } = await loadFixture(deployOracleFixture);
      const wallet = await otherSigners[0].getAddress();
      const chainId = (await ethers.provider.getNetwork()).chainId;
      const expiresAt = (await time.latest()) + Number(ONE_HOUR);
      const sig = await signScore(backendSigner, await oracle.getAddress(), chainId, {
        wallet, score: 820, tier: 1, expiresAt, nonce: 1n,
      });
      // Tamper: ask to verify with a different score.
      const tampered = await oracle.verifyScore.staticCall(wallet, 821, 1, expiresAt, 1n, sig.v, sig.r, sig.s);
      expect(tampered[0]).to.equal(false);
    });

    it("consumeNonce is only callable by the configured pool", async () => {
      const { oracle, otherSigners, owner, backendSigner } = await loadFixture(deployOracleFixture);
      const wallet = await otherSigners[0].getAddress();
      // Configure the pool to a random address.
      await oracle.connect(owner).setPool(await otherSigners[2].getAddress());
      // Random caller (not the pool) reverts.
      await expect(oracle.connect(otherSigners[0]).consumeNonce(wallet, 1n))
        .to.be.revertedWithCustomError(oracle, "Oracle__UnauthorizedCaller");
      // The pool itself succeeds.
      await expect(oracle.connect(otherSigners[2]).consumeNonce(wallet, 1n))
        .to.not.be.reverted;
      // And once consumed, a repeat reverts.
      await expect(oracle.connect(otherSigners[2]).consumeNonce(wallet, 1n))
        .to.be.revertedWithCustomError(oracle, "Oracle__StaleNonce");
      // Silence unused-warning.
      void backendSigner;
    });
  });

  describe("computeTier", () => {
    it("matches frontend mockData thresholds", async () => {
      const { oracle } = await loadFixture(deployOracleFixture);
      expect(await oracle.computeTier(1_000)).to.equal(1);
      expect(await oracle.computeTier(800)).to.equal(1);
      expect(await oracle.computeTier(799)).to.equal(2);
      expect(await oracle.computeTier(650)).to.equal(2);
      expect(await oracle.computeTier(649)).to.equal(3);
      expect(await oracle.computeTier(450)).to.equal(3);
      expect(await oracle.computeTier(449)).to.equal(4);
      expect(await oracle.computeTier(0)).to.equal(4);
    });
  });
});
