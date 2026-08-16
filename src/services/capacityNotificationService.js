const { LambdaClient, InvokeCommand } = require('@aws-sdk/client-lambda');

let lambdaClient;

const getLambdaClient = () => {
  if (!lambdaClient) {
    lambdaClient = new LambdaClient({ region: process.env.AWS_REGION });
  }
  return lambdaClient;
};

// Invoca de forma asincrona la Lambda que vive en el repositorio separado.
// Si no se configura el nombre, el desarrollo local continua sin AWS.
const invokeCapacityNotification = async (type, { eventId, organizerId, eventTitle, maxCapacity }) => {
  const functionName = process.env.AWS_LAMBDA_CAPACITY_FUNCTION_NAME;

  if (!functionName) {
    return { invoked: false, reason: 'AWS_LAMBDA_CAPACITY_FUNCTION_NAME no configurada' };
  }

  const payload = {
    type,
    eventId: eventId.toString(),
    organizerId: organizerId.toString(),
    eventTitle,
    maxCapacity,
    occurredAt: new Date().toISOString(),
  };

  await getLambdaClient().send(new InvokeCommand({
    FunctionName: functionName,
    InvocationType: 'Event',
    Payload: Buffer.from(JSON.stringify(payload)),
  }));

  return { invoked: true };
};

const notifyEventCapacityReached = (eventData) => (
  invokeCapacityNotification('EVENT_CAPACITY_REACHED', eventData)
);

const notifyEventCapacityAvailable = (eventData) => (
  invokeCapacityNotification('EVENT_CAPACITY_AVAILABLE', eventData)
);

module.exports = { notifyEventCapacityReached, notifyEventCapacityAvailable };
