require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

const app = express();
const port = process.env.PORT || 4000;

// Middleware
app.use(cors({ origin: "http://localhost:3000" }));
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
    // await client.connect();

    const db = client.db("crafty");
    const productsCol = db.collection("products");
    const ordersCol = db.collection("orders");
    const usersCol = db.collection("users");

    // === POST users in DB ===
    app.post("/users", async (req, res) => {
      const newUser = req.body;
      const email = newUser.email;
      const query = { email: email };

      const existingUser = await usersCol.findOne(query);
      if (existingUser) {
        res.send({ message: "User exists!" });
      } else {
        const result = await usersCol.insertOne(newUser);
        res.send(result);
      }
    });

    // === GET all products (public) ===
    app.get("/products", async (req, res) => {
      const result = await productsCol.find().sort({ createdAt: -1 }).toArray();
      res.send(result);
    });

    // === GET product by ID (public)===
    app.get("/products/:id", async (req, res) => {
      const id = req.params.id;
      const result = await productsCol.findOne({ _id: new ObjectId(id) });
      if (!result)
        return res.status(404).send({ message: "Product not found" });
      res.send(result);
    });

    // ----------------------------------------------------------------- //

    // === POST new product (protected) ===
    app.post("/products", async (req, res) => {
      const product = req.body;
      const email = product.email;

      if (!email) {
        return res
          .status(401)
          .send({ message: "Login required: email missing" });
      }

      product.createdAt = new Date();

      // 1. Insert into products (public)
      const prodResult = await productsCol.insertOne(product);

      // 2. Insert into orders (my orders)
      const orderDoc = {
        userEmail: email,
        productId: prodResult.insertedId,
        ...product,
      };
      await ordersCol.insertOne(orderDoc);

      res.send(prodResult);
    });

    // === GET my orders (protected) ===
    app.get("/orders", async (req, res) => {
      const email = req.query.email;
      if (!email) {
        return res
          .status(401)
          .send({ message: "Login required: email missing" });
      }

      const result = await ordersCol
        .find({ userEmail: email })
        .sort({ createdAt: -1 })
        .toArray();
      res.send(result);
    });

    // === DELETE order (protected) ===
    app.delete("/orders/:id", async (req, res) => {
      const id = req.params.id;
      const email = req.query.email;

      if (!email) {
        return res
          .status(401)
          .send({ message: "Login required: email missing" });
      }

      const order = await ordersCol.findOne({
        _id: new ObjectId(id),
        userEmail: email,
      });
      if (!order) {
        return res.status(403).send({ message: "Not owner or not found" });
      }

      await productsCol.deleteOne({ _id: order.productId });
      await ordersCol.deleteOne({ _id: new ObjectId(id) });

      res.send({ message: "Deleted", deletedId: id });
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
