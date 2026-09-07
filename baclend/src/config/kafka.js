import { Kafka } from 'kafkajs'

const KAFKACONFIG = process.env.KAFKA_BROKERS;
if (!KAFKACONFIG) {
    throw new Error('KAFKA_BROKERS environment variable is not defined');
}
const kafka = new Kafka({
    clientId: 'my-app',
    brokers: KAFKACONFIG.split(','),
});

export default kafka;