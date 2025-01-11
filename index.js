const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const {configDotenv} = require('dotenv');
const express = require('express');
const cors = require('cors');
var jwt = require('jsonwebtoken')
const cookieParser = require('cookie-parser')


const app = express();
app.use(express.json())
app.use(cookieParser());
app.use(
  cors({
    origin:  ['https://lodgio.netlify.app', 'http://localhost:5173'],
    credentials: true,
  })
);

const port = process.env.PORT || 5000;
configDotenv()

const verifyToken = (req, res, next) => {
  const token = req?.cookies?.token;
  if(!token){
    return res.status(401).send({message: 'Unauthorized access'})
  }
  jwt.verify(token, process.env.JWT, (err, decoded) => {
    if(err){
      return res.status(401).send({message: 'Unauthorized access'})
    }
    req.user = decoded;
  })
  next();
}

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
};


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
    
    // await client.connect();
    // await client.db("admin").command({ ping: 1 });

    const database = client.db('lodgio-db');
    const roomList = database.collection('roomList');
    const bookingList = database.collection('bookingList')
    // servers starts here ..........

    app.post('/jwt', async(req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.JWT,{expiresIn:'2h'});
      res.cookie('token',token,cookieOptions)
      .send({success:true})
    })




    app.get('/', async(req, res) => {
        res.send('Server is running ...................')
    })

    app.get('/rooms', async (req, res) => {
      let filter = {};
      let sort = {};
      const { priceRange, page=1 ,limit= 8 } = req.query; // Get the price range from query
      const pageNumber = parseInt(page, 10);
      const limitNumber = parseInt(limit, 10);
      
    
      if (priceRange === 'lowest-first') {
        sort = { pricePerNight: 1 }; // Sort by price in ascending order
      }
      else if (priceRange === '100-200') { // Corrected to string format
        filter.pricePerNight = { $gte: 100, $lte: 200 }; // Filter between $100 and $200
      }
      else if (priceRange === '200-300') { // Corrected to string format
        filter.pricePerNight = { $gte: 200, $lte: 300 }; // Filter between $200 and $300
      }
      else if (priceRange === '300-400') { // Corrected to string format
        filter.pricePerNight = { $gte: 300, $lte: 400 }; // Filter between $300 and $400
      }
      else if (priceRange === 'highest-first') {
        sort = { pricePerNight: -1 }; // Sort by price in descending order
      }

      const skip =( pageNumber - 1) * limitNumber

        const result = await roomList.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(limitNumber)
        .toArray(); // Apply filter and sort

        const totalCount = await roomList.countDocuments(filter);
        totalPages = Math.ceil(totalCount/limitNumber)
        res.json({
          rooms: result, // Paginated rooms data
          totalCount, // Total number of rooms
          totalPages, // Total number of pages
          currentPage: pageNumber, // Current page number
        });// Send the result back to the client
    });
    
    app.get('/room/rated', async(req,res)=> {
      const rooms = await roomList.find().toArray();
      const sortedRooms = rooms.sort((a, b) => (b.reviews?.length || 0) - (a.reviews?.length || 0));
      const limitedRooms = sortedRooms.slice(0,8)
      res.send(limitedRooms)
    })



    // Fetch single room by ID
    app.get('/room/:id', async (req, res) => {
      try {
        const id = req.params.id;
        const result = await roomList.findOne({ _id: new ObjectId(id) });
        res.send(result);
      } catch (error) {
        console.error('Error fetching room:', error);
        res.status(500).send({ message: 'Internal Server Error' });
      }
    });

    app.patch('/room/:id', async(req, res)=> {
      const id = req.params.id
      const update = req.body;
      const result = roomList.updateOne({ _id: new ObjectId(id)},{$set:update});
      res.send(result)
    })


    app.patch('/booking/:id',verifyToken, async(req, res)=> {
      const id = req.params.id
      const update = req.body;
      const result = bookingList.updateOne({ _id: new ObjectId(id)},{$set:update});
      res.send(result)
    })

    app.patch('/booking/review/:id', async(req, res)=> {
      const id = req.params.id
      const update = req.body;
      const result = bookingList.updateOne({ _id: new ObjectId(id)},{$set:update});
      res.send(result)
    })

    app.delete('/room/:id',verifyToken, async (req, res) => {
      const id = req.params.id;
      const bookingId = req.query._id;
      
      const result = await roomList.updateOne(
        { _id: new ObjectId(id)},
        { $pull: { reviews: { bookingId } } }
      );
      res.send(result);
    });
    


    app.get('/bookings',verifyToken, async(req, res)=> {
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
      const roomId = req.query.roomId;
      res.send(result)
    })

    app.get('/booking/:id',verifyToken, async(req, res)=> {
      const id = req.params.id
      const result = await bookingList.findOne({_id: new ObjectId(id)});
      const roomId = result?.roomId;
      const roomData = await roomList.findOne({ _id :new ObjectId(roomId)})
      if(roomData){
        result.pricePerNight = roomData.pricePerNight;
        result.imageUrl = roomData.imageUrl;
        result.reviews = roomData.reviews;
      }
      res.send(result)
    })



    app.post('/bookings',verifyToken,async(req, res)=> {
      const data = req.body;
      const result = bookingList.insertOne(data);
      res.send(result)
    })


    app.delete('/booking/:id', async(req,res)=>{
      const id = req.params.id
      const result = bookingList.deleteOne({ _id: new ObjectId(id)})
      res.send(result)
    })

    app.post('/room/:id',verifyToken,async(req, res)=> {
      const id = req.params.id;
      const newReview = req.body;
      const result = await roomList.updateOne( {_id : new ObjectId(id)},{
        $push: {reviews: newReview},
      });
      res.send(result)
      
    })

app.get('/reviews', async (req, res) => {
    try {
        const allReviews = [];
        const sort = { timestamp : -1}
        const rooms = await roomList.find().sort(sort).limit(6).toArray(); // Fetch all rooms

        for (const room of rooms) {
            if (Array.isArray(room.reviews) && room.reviews.length > 0) {
                allReviews.push(...room.reviews); // Add all reviews from the current room
            }
          

        }
        allReviews.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        res.json(allReviews); // Send the collected reviews as a JSON response
    } catch (error) {
        console.error('Error fetching reviews:', error);
        res.status(500).send('Internal Server Error'); // Handle errors gracefully
    }
});

app.get('/review/:id', async (req, res) => {
  const id = req.params.id;
  const bId = req.query.bId; // Extract the value of bId from req.query
    const data = await roomList.findOne({ _id: new ObjectId(id) });
    const datalist = data.reviews || []; // Ensure datalist is defined, default to an empty array
    const result = datalist.filter(r => r.bookingId === bId); // Compare correctly
    res.json(result[0]); // Send the filtered reviews as a response
});


  } finally {
    // await client.close();
  }
}
run().catch(console.dir);


app.listen(port,()=>{
    // console.log(`Listening on port : ${port}`)
})