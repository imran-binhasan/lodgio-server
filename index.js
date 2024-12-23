const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const {configDotenv} = require('dotenv');
configDotenv()

const app = express();
app.use(cors())
app.use(express.json())
const port = process.env.PORT || 5000;



const uri = process.env.CONNECTION_STRING;


const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    
    await client.connect();
    await client.db("admin").command({ ping: 1 });
    console.log("You successfully connected to MongoDB!");
    const database = client.db('lodgio-db');
    const roomList = database.collection('roomList');
    const bookingList = database.collection('bookingList')
    // servers starts here ..........
    app.get('/', async(req, res) => {
        res.send('Server is running ...................')
    })

    app.get('/rooms', async(req, res)=> {
      const result = await roomList.find().toArray()
      res.send(result)
    })

    app.get('/room/:id', async(req, res)=> {
      const id = req.params.id
      const result = await roomList.findOne({_id: new ObjectId(id)})
      res.send(result)
    })


    app.get('/bookings',async(req, res)=> {
      const email = req.query.email;
      const result =await bookingList.find({userEmail : email}).toArray();
      for (const each of result){
        const roomData = await roomList.findOne({ _id : new ObjectId(each.roomId)});
        if(roomData){
          each.imageUrl = roomData.imageUrl;
          each.hotelName = roomData.hotelName;
          each.pricePerNight = roomData.pricePerNight;
        }
      }
      res.send(result)
    })



    app.post('/bookings',async(req, res)=> {
      const data = req.body;
      const result = bookingList.insertOne(data);
      res.send(result)
    })

    app.patch('/bookings/:id', async(req, res)=> {
      const id = req.params.id
      const update = req.body;
      const result = roomList.updateOne({ _id: new ObjectId(id)},{$set:update});
      res.send(result)
    })





  } finally {
    // await client.close();
  }
}
run().catch(console.dir);


app.listen(port,()=>{
    console.log(`Listening on port : ${port}`)
})