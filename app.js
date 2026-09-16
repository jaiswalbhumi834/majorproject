require("dns").setDefaultResultOrder("ipv4first");
const dns = require("dns");
dns.setServers(["8.8.8.8"]);

if(process.env.NODE_ENV != "production"){
    require('dotenv').config({override: true});
}
if(process.env.NODE_ENV != "production"){
    require('dotenv').config({override: true});
}


const express = require("express");
const app = express();
const mongoose = require("mongoose");
const path = require("path");
const methodOverride = require("method-override");
const ejsMate = require("ejs-mate");
const wrapAsync = require("./utils/wrapAsync.js");
const ExpressError = require("./utils/ExpressError.js");
const session = require("express-session");
const MongoStore = require("connect-mongo").default;
const flash = require("connect-flash");
const passport = require("passport");
const LocalStrategy = require("passport-local");
const User = require("./models/user.js");

const listingRouter = require("./routes/listing.js");
const reviewRouter = require("./routes/review.js");
const userRouter = require("./routes/user.js");

// const MONGO_URL = "mongodb://127.0.0.1:27017/wanderlust";
const dbUrl = process.env.ATLASDB_URL;

console.log("DB URL =", JSON.stringify(dbUrl));
console.log("Starts with mongodb =", dbUrl.startsWith("mongodb://"));

main()
.then(() => {
    console.log("connected to db");
})
.catch((err) => {
    console.log(err);
});
async function main() {
    await mongoose.connect(dbUrl);
}

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.urlencoded({extended: true}));
app.use(methodOverride("_method"));
app.engine('ejs', ejsMate);
app.use(express.static(path.join(__dirname, "/public")));

const store = MongoStore.create({
    mongoUrl: dbUrl,
    secret: process.env.SECRET,
    touchAfter: 24 * 3600,
});

store.on("error", () => {
    console.log("ERROR IN MONGO SESSION STORE", err);
});

const sessionOptions = {
    store,
    secret :  process.env.SECRET,
    resave: false,
    saveUninitialized: true,
    cookie:{
        expires: Date.now() + 7 * 24 * 60 * 60 * 1000,
        maxAge: 7 * 24 * 60 * 60 * 1000,
        httpOnly: true
    }
};


// app.get("/", (req, res) => {
//     res.send("hi, i'm root");
// });

app.use(session(sessionOptions));
app.use(flash());

app.use(passport.initialize());
app.use(passport.session());
passport.use(new LocalStrategy(User.authenticate()));

passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

app.use((req, res, next) => {
    res.locals.success = req.flash("success");
    res.locals.error = req.flash("error");
    res.locals.currUser = req.user;
    next();
});

// app.get( "/demouser", async(req, res) => {
//     let fakeUser = new User({
//         email: "student@gmail.com",
//         username: "delta-student"
//     });

//     let registeredUser = await User.register(fakeUser, "helloworld");
//     res.send(registeredUser);
// });

app.use("/listings", listingRouter);
app.use("/listings/:id/reviews", reviewRouter);
app.use("/", userRouter);

//index route
app.get("/listings", wrapAsync(async (req, res) => {
    const allListings = await Listing.find({});
    res.render("listings/index.ejs", {allListings});
}));

//new route
app.get("/listings/new" , (req, res) => {
    res.render("listings/new.ejs");
});

//show route
app.get("/listings/:id", wrapAsync( async (req, res) => {
    let {id} = req.params;
   const listing = await Listing.findById(id).populate("reviews");
   res.render("listings/show.ejs", {listing});
}));

// create route
app.post("/listings", wrapAsync (async (req, res , next) => {
    // let {title, description, image, price, country, location} = req.body;
    // let listing = req.body.listing;
    
    const newListing = new Listing(req.body.listing);
    await newListing.save();
    res.redirect("/listings");
    
}));

//edit route
app.get("/listings/:id/edit", wrapAsync (async(req, res) => {
    let {id} = req.params;
    const listing = await Listing.findById(id);
    res.render("listings/edit.ejs", {listing});
}));

//update route
app.put("/listings/:id", wrapAsync( async(req, res) => {
   
    let {id} = req.params;
    await Listing.findByIdAndUpdate(id, {...req.body.listing});
    res.redirect(`/listings/${id}`);
}));

//delete route
app.delete("/listings/:id",wrapAsync( async(req, res) => {
    let {id} = req.params;
    let deletedListing = await Listing.findByIdAndDelete(id);
    console.log(deletedListing);
    res.redirect("/listings");
}));

app.use("/listings", listingRouter);
app.use("/listings/:id/reviews", reviewRouter);

// app.get("/testListing", async (req, res) => {
//     let sampleListing  =  new Listing({
//         title: "My New Villa",
//         description: "By the beach",
//         price: 1200,
//         location: "Calangute, Goa",
//         country: "India"
//     });
//     await sampleListing.save();
//     console.log("sample was saved");
//     res.send("successful");
// });

app.all("/*splat", (req, res, next) => {
    next(new ExpressError(404, "Page not Found"));
});

app.use((err, req, res, next) => {
    let {statusCode=500, message = "something went wrong"} = err;
    res.status(statusCode).render("error.ejs", {err});
    // res.status(statusCode).send(message);
});

app.listen(8080,() => {
    console.log("listening on port 8080");
} );