import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;

  const deployedZSphereGame = await deploy("ZSphereGame", {
    from: deployer,
    log: true,
  });

  console.log(`ZSphereGame contract: `, deployedZSphereGame.address);
};
export default func;
func.id = "deploy_zsphere_game"; // id required to prevent reexecution
func.tags = ["ZSphereGame"];
