const mongoose = require('mongoose');

/**
 * Establece la conexion a MongoDB utilizando Mongoose.
 * La URI se obtiene desde las variables de entorno (MONGODB_URI).
 * Debe invocarse una unica vez al iniciar el servidor (ver server.js).
 */
const connectDB = async () => {
  const mongoUri = process.env.MONGODB_URI;

  if (!mongoUri) {
    throw new Error('MONGODB_URI no esta definida en las variables de entorno');
  }

  try {
    const conn = await mongoose.connect(mongoUri);
    console.log(`MongoDB conectado: ${conn.connection.host}/${conn.connection.name}`);
    return conn;
  } catch (error) {
    console.error(`Error al conectar a MongoDB: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
