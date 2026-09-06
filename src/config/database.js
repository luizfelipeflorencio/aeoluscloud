import mongoose from 'mongoose';

const conectarBanco = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      auth: {
        username: process.env.MONGO_USER,
        password: process.env.MONGO_PASSWORD
      },
      authSource: process.env.MONGO_AUTH_SOURCE || 'admin'
    });
    console.log('Conectado ao MongoDB');
  } catch (error) {
    console.error('Erro ao conectar ao MongoDB:', error);
    process.exit(1);
  }
};

export default conectarBanco;