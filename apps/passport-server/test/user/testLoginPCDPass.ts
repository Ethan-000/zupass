import { User } from "@pcd/passport-interface";
import { Identity } from "@semaphore-protocol/identity";
import { expect } from "chai";
import httpMocks from "node-mocks-http";
import { PCDPass } from "../../src/types";

export async function testLoginPCDPass(
  application: PCDPass,
  email: string,
  force: boolean,
  userAlreadyLoggedIn: boolean
): Promise<User> {
  const { userService, emailTokenService } = application.services;
  const identity = new Identity();
  const commitment = identity.commitment.toString();
  const sendEmailResponse = httpMocks.createResponse();
  await userService.handleSendPcdPassEmail(
    email,
    commitment,
    force,
    sendEmailResponse
  );

  if (userAlreadyLoggedIn && !force) {
    expect(sendEmailResponse.statusCode).to.eq(500);
    expect(sendEmailResponse._getBuffer().toString()).to.contain(
      "already registered"
    );
    throw new Error("already registeredd");
  } else {
    expect(sendEmailResponse.statusCode).to.eq(200);
  }

  let token: string;

  if (userService.bypassEmail) {
    const sendEmailResponseJson = sendEmailResponse._getJSONData();
    expect(sendEmailResponseJson).to.haveOwnProperty("token");
    token = sendEmailResponseJson.token;
  } else {
    token = (await emailTokenService.getTokenForEmail(email)) as string;
    expect(token).to.not.eq(null);
  }

  const newUserResponse = httpMocks.createResponse();
  await userService.handleNewPcdPassUser(
    token,
    email,
    commitment,
    newUserResponse
  );

  const newUserResponseJson = newUserResponse._getJSONData();
  expect(newUserResponseJson).to.haveOwnProperty("uuid");
  expect(newUserResponseJson).to.haveOwnProperty("commitment");
  expect(newUserResponseJson).to.haveOwnProperty("email");
  expect(newUserResponseJson.commitment).to.eq(commitment);
  expect(newUserResponseJson.email).to.eq(email);

  const getUserResponse = httpMocks.createResponse();
  await userService.handleGetPcdPassUser(
    newUserResponseJson.uuid,
    getUserResponse
  );
  const getUserResponseJson = getUserResponse._getJSONData();

  expect(getUserResponseJson).to.deep.eq(newUserResponseJson);

  return getUserResponseJson;
}