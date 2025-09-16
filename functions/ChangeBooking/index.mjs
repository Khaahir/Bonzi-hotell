import { client } from "../../service/db.mjs";
import {PutCommand} from '@aws-sdk/lib-dynamodb'
export const  ChangeBooking = async (event) => {

  return {
    statusCode: 200,
    body: JSON.stringify({
      message: "Go Serverless v4! Your function executed successfully!",
    }),
  };
};
