import type { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";

dotenv.config();

const PRIVATE_KEY = process.env.PRIVATE_KEY ?? "0x" + "0".repeat(64);
const HSK_TESTNET_RPC = process.env.HSK_TESTNET_RPC ?? "http://127.0.0.1:8545";
const HSK_MAINNET_RPC = process.env.HSK_MAINNET_RPC ?? "http://127.0.0.1:8545";
const REPORT_GAS = process.env.REPORT_GAS === "true";

// HSK Chain chain IDs are placeholders until confirmed against the live RPC.
// Patch the values below once the official testnet/mainnet chain IDs are known.
const HSK_TESTNET_CHAIN_ID = 133;
const HSK_MAINNET_CHAIN_ID = 9001;

const config: HardhatUserConfig = {
  mocha: {
    timeout: 120_000,
  },
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      viaIR: true,
      evmVersion: "cancun",
    },
  },
  networks: {
    hardhat: {
      chainId: 31337,
    },
    localhost: {
      url: "http://127.0.0.1:8545",
    },
    hskTestnet: {
      url: HSK_TESTNET_RPC,
      chainId: HSK_TESTNET_CHAIN_ID,
      accounts: [PRIVATE_KEY],
    },
    hskMainnet: {
      url: HSK_MAINNET_RPC,
      chainId: HSK_MAINNET_CHAIN_ID,
      accounts: [PRIVATE_KEY],
    },
  },
  etherscan: {
    apiKey: {
      hskTestnet: process.env.HSK_EXPLORER_API_KEY ?? "placeholder",
      hskMainnet: process.env.HSK_EXPLORER_API_KEY ?? "placeholder",
    },
    customChains: [
      {
        network: "hskTestnet",
        chainId: HSK_TESTNET_CHAIN_ID,
        urls: {
          apiURL: "https://testnet-explorer.hashfans.io/api",
          browserURL: "https://testnet-explorer.hashfans.io",
        },
      },
      {
        network: "hskMainnet",
        chainId: HSK_MAINNET_CHAIN_ID,
        urls: {
          apiURL: "https://explorer.hashfans.io/api",
          browserURL: "https://explorer.hashfans.io",
        },
      },
    ],
  },
  gasReporter: {
    enabled: REPORT_GAS,
    currency: "USD",
  },
  typechain: {
    outDir: "typechain-types",
    target: "ethers-v6",
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
};

export default config;