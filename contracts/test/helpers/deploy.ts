import { ethers } from "hardhat";
import type { Signer } from "ethers";
import type { CrediFiOracle, CrediFiPool } from "../../typechain-types";

export interface DeployedOracle {
  oracle: CrediFiOracle;
  owner: Signer;
  backendSigner: Signer;
  otherSigners: Signer[];
}

export interface DeployedPool {
  oracle: CrediFiOracle;
  pool: CrediFiPool;
  owner: Signer;
  backendSigner: Signer;
  treasury: Signer;
  lender: Signer;
  lenderAddress: string;
  otherSigners: Signer[];
}

/**
 * Deploy a fresh CrediFiOracle with a known backend signer.
 * The first signer returned by `ethers.getSigners()` is the deployer / owner.
 * The second signer is the configured backend signer.
 */
export async function deployOracleFixture(): Promise<DeployedOracle> {
  const signers = await ethers.getSigners();
  const [owner, backendSigner, ...rest] = signers;
  const Oracle = await ethers.getContractFactory("CrediFiOracle");
  const oracle = (await Oracle.connect(owner).deploy(await backendSigner.getAddress())) as CrediFiOracle;
  await oracle.waitForDeployment();
  return { oracle, owner, backendSigner, otherSigners: rest };
}

/**
 * Deploy Oracle + Pool, register the pool on the oracle, and seed the pool
 * with 1000 HSK from a fresh lender signer (the third signer).
 */
export async function deployPoolWithLiquidityFixture(): Promise<DeployedPool> {
  const signers = await ethers.getSigners();
  const [owner, backendSigner, lender, treasury, ...rest] = signers;
  const { oracle } = await deployOracleFixture();
  const Pool = await ethers.getContractFactory("CrediFiPool");
  const pool = (await Pool.connect(owner).deploy(
    await oracle.getAddress(),
    await treasury.getAddress(),
  )) as CrediFiPool;
  await pool.waitForDeployment();
  // Wire the pool into the oracle so consumeNonce will accept calls.
  await oracle.connect(owner).setPool(await pool.getAddress());

  // Seed liquidity: 1000 HSK from the lender.
  await pool.connect(lender).deposit({ value: ethers.parseEther("1000") });

  return {
    oracle,
    pool,
    owner,
    backendSigner,
    treasury,
    lender,
    lenderAddress: await lender.getAddress(),
    otherSigners: rest,
  };
}
