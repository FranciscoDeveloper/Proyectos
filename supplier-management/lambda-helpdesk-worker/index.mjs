/**
 * dairi-helpdesk-worker
 *
 * Triggered by SQS queue: dairi-helpdesk-messages
 * Persists each helpdesk ticket into DynamoDB table: dairi-helpdesk
 *
 * DynamoDB item schema (kept < 1 KB per item to stay within free-tier WCU):
 *   ticketId   (S) PK  — UUID from SQS MessageId
 *   userId     (S) GSI — string cast of numeric user id
 *   timestamp  (S) GSI — ISO-8601 timestamp from message
 *   userEmail  (S)
 *   userName   (S)
 *   content    (S)     — max 500 chars (enforced by helpdesk Lambda)
 *   status     (S)     — "open" on creation
 *   source     (S)     — "dairi-helpdesk"
 *   sqsMessageId (S)   — original SQS MessageId for dedup reference
 */

import {
  DynamoDBClient,
  PutItemCommand,
} from "@aws-sdk/client-dynamodb";
import { marshall } from "@aws-sdk/util-dynamodb";

const dynamo    = new DynamoDBClient({ region: process.env.AWS_REGION || "us-east-1" });
const TABLE     = process.env.DYNAMO_TABLE || "dairi-helpdesk";

export const handler = async (event) => {
  const results = await Promise.allSettled(
    event.Records.map(record => processRecord(record))
  );

  // Partial-batch failure: report failed message IDs so SQS retries them
  const failed = results
    .map((r, i) => ({ r, id: event.Records[i].messageId }))
    .filter(({ r }) => r.status === "rejected")
    .map(({ id }) => ({ itemIdentifier: id }));

  if (failed.length > 0) {
    console.error(JSON.stringify({ msg: "Some records failed", count: failed.length }));
    return { batchItemFailures: failed };
  }

  return { batchItemFailures: [] };
};

async function processRecord(record) {
  let body;
  try {
    body = JSON.parse(record.body);
  } catch {
    // Unparseable message — discard (don't retry)
    console.error(JSON.stringify({ msg: "Unparseable SQS body", messageId: record.messageId }));
    return;
  }

  const ticketId = record.messageId;
  const timestamp = body.timestamp || new Date().toISOString();

  const item = {
    ticketId,
    userId:       String(body.userId ?? "unknown"),
    timestamp,
    userEmail:    body.userEmail  ?? "",
    userName:     body.userName   ?? "",
    content:      String(body.content ?? "").slice(0, 500),
    status:       "open",
    source:       body.source ?? "dairi-helpdesk",
    sqsMessageId: record.messageId,
  };

  try {
    await dynamo.send(new PutItemCommand({
      TableName: TABLE,
      Item:      marshall(item, { removeUndefinedValues: true }),
      // Idempotent: if the same messageId arrives again, overwrite is fine
    }));

    console.log(JSON.stringify({
      msg:      "Ticket persisted",
      ticketId,
      userId:   item.userId,
      timestamp,
    }));
  } catch (err) {
    console.error(JSON.stringify({ msg: "DynamoDB PutItem failed", ticketId, error: err.message }));
    throw err; // signal partial-batch failure so SQS retries
  }
}
