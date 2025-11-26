require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

const app = express();
const port = process.env.PORT || 4000;

// Middleware
app.use(
  cors({
    origin: "http://localhost:3000",
  })
);
app.use(express.json());

// MongoDB URI
const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error("MONGODB_URI is not set in .env");
  process.exit(1);
}

// MongoDB Client
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

// Test route
app.get("/", (req, res) => {
  res.send("Crafty API is running!");
});

async function run() {
  try {
    // Connect to MongoDB
    await client.connect();

    const db = client.db("crafty");
    const productsCollection = db.collection("products");

    // === GET all products (public) ===
    app.get("/products", async (req, res) => {
      const query = {};
      const cursor = productsCollection.find(query).sort({ createdAt: -1 });
      const result = await cursor.toArray();
      res.send(result);
    });

    // === GET product by ID ===
    app.get("/products/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await productsCollection.findOne(query);
      if (!result) {
        return res.status(404).send({ message: "Product not found" });
      }
      res.send(result);
    });

    // === POST new product (protected) ===
    app.post("/products", async (req, res) => {
      const newProduct = req.body;
      newProduct.createdAt = new Date();

      const result = await productsCollection.insertOne(newProduct);
      res.send(result);
    });

    // === DELETE product by ID (protected) ===
    app.delete("/products/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };

      const result = await productsCollection.deleteOne(query);
      if (result.deletedCount === 0) {
        return res.status(404).send({ message: "Product not found" });
      }
      res.send({ message: "Product deleted", deletedId: id });
    });

    // === Ping MongoDB ===
    console.log("Connected to MongoDB! (crafty DB)");
  } catch (error) {
    console.error("MongoDB connection failed:", error);
    process.exit(1);
  }
}
run().catch(console.dir);

// Start server
app.listen(port, () => {
  console.log(`Crafty server running on http://localhost:${port}`);
});
