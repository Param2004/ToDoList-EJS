const express = require("express");
const bodyParser = require("body-parser");
const date = require(__dirname + "/date.js");
const mongoose = require("mongoose");
const _ = require("lodash");
const cors = require("cors"); // Allow frontend requests
const port = process.env.PORT || 3001;

const session = require("express-session");
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");
const bcrypt = require("bcrypt");


const app = express();

app.set('view engine', 'ejs');

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static("public"));
app.use(cors());


app.use(session({
    secret: "Our little secret.",
    resave: false,
    saveUninitialized: false
}));

app.use(passport.initialize());
app.use(passport.session());


mongoose.connect("mongodb+srv://param2004:param3431@cluster0.zkgsb7i.mongodb.net/?retryWrites=true&w=majority");


const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    list: { type: mongoose.Schema.Types.ObjectId, ref: "List" }
});

userSchema.plugin(passportLocalMongoose);

const User = mongoose.model("ToDoUser", userSchema);
passport.use(User.createStrategy());

passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

// Schema with position field
const itemsSchema = {
    name: String,
    position: { type: Number, default: 0 }
};

const Item = mongoose.model("Task", itemsSchema);

const item1 = new Item({ name: "Task 1", position: 0 });
const item2 = new Item({ name: "Task 2", position: 1 });
const item3 = new Item({ name: "Task 3", position: 2 });

const dfltItms = [item1, item2, item3];

const listSchema = {
    name: { type: String, required: true, unique: true },
    items: [itemsSchema]
};

const List = mongoose.model("List", listSchema);

// Fetch tasks in order
app.get("/", (req, res) => {

    res.render("home");

    // let day = date.getDay();
    // Item.find().sort({ position: 1 }).then((items) => {
    //     if (items.length === 0) {
    //         Item.insertMany(dfltItms).then(() => {
    //             console.log("Default items inserted");
    //             res.redirect("/");
    //         });
    //     } else {
    //         res.render("list", { listTitle: day, newListItems: items });
    //     }
    // }).catch((err) => console.log(err));
});


app.get("/register", (req, res) => {
    res.render("register"); // Create register.ejs for the signup form
});

app.post("/register", async (req, res) => {
    try {
        const hashedPassword = await bcrypt.hash(req.body.password, 10);
        const newUser = new User({
            username: req.body.username,
            email: req.body.email,
            password: hashedPassword
        });

        await newUser.save();
        
        // Create a personalized list for the new user
        const userList = new List({
            name: req.body.username,
            items: dfltItms
        });

        await userList.save();

        newUser.list = userList._id;
        await newUser.save();

        res.redirect("/login");
    } catch (err) {
        console.error(err);
        res.redirect("/register");
    }
});


app.get("/login", (req, res) => {
    res.render("login"); // Create login.ejs for the login form
});

app.post("/login", async (req, res) => {
    try {
        const user = await User.findOne({ username: req.body.username });
        if (!user) {
            return res.redirect("/login");
        }

        const match = await bcrypt.compare(req.body.password, user.password);
        if (match) {
            req.login(user, (err) => {
                if (err) return console.error(err);
                res.redirect("/" + user.username); // Redirect to custom list
            });
        } else {
            res.redirect("/login");
        }
    } catch (err) {
        console.error(err);
        res.redirect("/login");
    }
});



// Add new item
// app.post("/", async (req, res) => {
//     const item = req.body.newItem;
//     const list = req.body.list;
//     let day = date.getDay();

//     try {
//         const count = await Item.countDocuments();
//         const newItem = new Item({ name: item, position: count });

//         if (list === day) {
//             await newItem.save();
//             res.redirect("/");
//         } else {
//             const found = await List.findOne({ name: list });
//             if (found) {
//                 found.items.push(newItem);
//                 await found.save();
//             }
//             res.redirect("/" + list);
//         }
//     } catch (err) {
//         console.error(err);
//         res.redirect("/");
//     }
// });

app.post("/", async (req, res) => {
    const item = req.body.newItem;
    const list = req.body.list;
    const username = req.user.username; // Get the logged-in user's username

    try {
        const count = await Item.countDocuments(); // Get the total count of items in the Item collection

        // Create the new item with an initial position (count of documents)
        const newItem = new Item({ name: item, position: count });

        // Get the user's document
        const user = await User.findOne({ username }).populate("list");

        // If the user's list is for today (e.g., the 'day' variable matches), add the item
        if (user && user.list) {
            // Add the item to the Item collection and then to the user's list
            await newItem.save();
            user.list.items.push(newItem);  // Add the new item to the user's list
            await user.list.save(); // Save the list with the new item
        }
        res.redirect("/" + username);
    } catch (err) {
        console.error(err);
        res.redirect("/"); // Redirect on error
    }
});



// Delete an item (Per User List)
app.post("/delete", isAuthenticated, async (req, res) => {
    const checkedItemId = req.body.check;
    const username = req.user.username; // Get logged-in user's username

    try {
        const user = await User.findOne({ username }).populate("list");

        if (user && user.list) {
            await List.findOneAndUpdate(
                { _id: user.list._id },
                { $pull: { items: { _id: checkedItemId } } }
            );
        }

        res.redirect("/" + username);
    } catch (err) {
        console.error(err);
        res.redirect("/" + username);
    }
});

// Edit an item (Per User List)
// app.post("/edit", isAuthenticated, async (req, res) => {
//     const { itemId, updatedName } = req.body;
//     const username = req.user.username; // Get logged-in user's username

//     try {
//         const user = await User.findOne({ username }).populate("list");

//         if (user && user.list) {
//             await List.findOneAndUpdate(
//                 { _id: user.list._id, "items._id": itemId },
//                 { $set: { "items.$.name": updatedName } }
//             );
//         }

//         res.redirect("/" + username);
//     } catch (err) {
//         console.error(err);
//         res.redirect("/" + username);
//     }
// });


app.post("/edit", isAuthenticated, async (req, res) => {
    const { itemId, updatedName, listName } = req.body;
    const username = req.user.username; // Get logged-in user's username

    console.log("Item ID:", itemId);
    console.log("Updated Name:", updatedName); // Debugging: Log the new name

    try {
        const user = await User.findOne({ username }).populate("list");

        if (user && user.list) {
            const list = user.list; // Get the user's list
            
            // Make sure the item exists
            const item = list.items.id(itemId);
            if (item) {
                item.name = updatedName; // Update item name
                await list.save(); // Save the updated list
            }
        }

        res.redirect("/" + username);
    } catch (err) {
        console.error("Error updating item:", err);
        res.redirect("/" + username);
    }
});


// Delete an item
// app.post("/delete", async (req, res) => {
//     const checkedoff = req.body.check;
//     const listName = req.body.listName;
//     let day = date.getDay();

//     try {
//         if (listName === day) {
//             await Item.findByIdAndDelete(checkedoff);
//             res.redirect("/");
//         } else {
//             await List.findOneAndUpdate(
//                 { name: listName },
//                 { $pull: { items: { _id: checkedoff } } }
//             );
//             res.redirect("/" + listName);
//         }
//     } catch (err) {
//         console.error(err);
//         res.redirect("/");
//     }
// });


// app.post("/edit", async (req, res) => {
//     const { itemId, updatedName, listName } = req.body;
//     let day = date.getDay();

//     try {
//         if (listName === day) {
//             // Update item in the default list
//             await Item.findByIdAndUpdate(itemId, { name: updatedName });
//             res.redirect("/");
//         } else {
//             // Update item in a custom list
//             await List.findOneAndUpdate(
//                 { name: listName, "items._id": itemId },
//                 { $set: { "items.$.name": updatedName } }
//             );
//             res.redirect("/" + listName);
//         }
//     } catch (err) {
//         console.error(err);
//         res.redirect("/");
//     }
// });



// Handle drag-and-drop reordering (Per User List)
app.post("/reorder", isAuthenticated, async (req, res) => {
    const { order } = req.body;
    const username = req.user.username; // Get logged-in user's username

    if (!Array.isArray(order)) {
        return res.status(400).json({ message: "Invalid order data" });
    }

    try {
        const user = await User.findOne({ username }).populate("list");

        if (user && user.list) {
            for (let i = 0; i < order.length; i++) {
                await List.findOneAndUpdate(
                    { _id: user.list._id, "items._id": order[i].id },
                    { $set: { "items.$.position": i } }
                );
            }
        }

        res.status(200).json({ message: "Order updated successfully" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Internal server error" });
    }
});


// Handle drag-and-drop reordering
// app.post("/reorder", async (req, res) => {
//     const { order } = req.body;

//     if (!Array.isArray(order)) {
//         return res.status(400).json({ message: "Invalid order data" });
//     }

//     try {
//         for (let i = 0; i < order.length; i++) {
//             await Item.findByIdAndUpdate(order[i].id, { position: i });
//         }
//         res.status(200).json({ message: "Order updated successfully" });
//     } catch (error) {
//         console.error(error);
//         res.status(500).json({ message: "Internal server error" });
//     }
// });


function isAuthenticated(req, res, next) {
    if (req.isAuthenticated()) {
        return next();
    }
    res.redirect("/login");
}

// app.get("/:customList", isAuthenticated, async (req, res) => {
//     const listName = _.capitalize(req.params.customList);

//     try {
//         let user = await User.findOne({ username: listName }).populate("list");

//         console.log("User found:", user); // Debugging

//         if (!user) {
//             // 🛠 Create a new list
//             const newList = new List({ name: listName, items: dfltItms });
//             await newList.save();

//             // 🛠 Create a new user with the list
//             user = new User({ username: listName, email: "", password: "", list: newList._id });
//             await user.save();

//             console.log("New User Created:", user); // Debugging
//             return res.redirect("/" + listName);
//         }

//         // 🛠 Ensure list is populated before rendering
//         if (!user.list) {
//             console.log("User has no list associated! Creating one.");
//             const newList = new List({ name: listName, items: dfltItms });
//             await newList.save();
//             user.list = newList._id;
//             await user.save();
//             return res.redirect("/" + listName);
//         }

//         res.render("list", {
//             listTitle: user.username,
//             newListItems: user.list.items.sort((a, b) => a.position - b.position) || []
//         });

//     } catch (err) {
//         console.error("Error:", err);
//         res.redirect("/login");
//     }
// });


// app.get("/:customList", isAuthenticated, async (req, res) => {
//     const listName = _.capitalize(req.params.customList);

//     try {
//         let user = await User.findOne({ username: listName }).populate("list");
//         console.log(user);

//         if (!user) {
//             user = new List({ name: listName, items: dfltItms });
//             await user.save();
//             res.redirect("/" + listName);
//         } else {
//             res.render("list", { listTitle: user.name, newListItems: user.items.sort((a, b) => a.position - b.position) });
//         }
//     } catch (err) {
//         console.error(err);
//         res.redirect("/login");
//     }
// });


// Custom lists
app.get("/:customList", isAuthenticated, async (req, res) => {
    const listName = req.params.customList;

    try {
        let found = await List.findOne({ name: listName });
        if (!found) {
            found = new List({ name: listName, items: dfltItms });
            await found.save();
            res.redirect("/" + listName);
        } else {
            res.render("list", { listTitle: found.name, newListItems: found.items.sort((a, b) => a.position - b.position) });
        }
    } catch (err) {
        console.error(err);
        res.redirect("/");
    }
});

// About Page
app.get("/about", (req, res) => {
    res.render("about");
});

app.get("/logout", (req, res) => {
    req.logout((err) => {
        if (err) return console.error(err);
        return res.redirect("/login");
    });
});


// Start Server
app.listen(port, () => {
    console.log(`Server is Running on port ${port} 😊👌`);
});



// const express = require("express");
// const bodyParser = require("body-parser");
// const date = require(__dirname + "/date.js");
// const mongoose = require("mongoose");
// const _ = require("lodash");
// const port = process.env.PORT || 3001;

// const app = express();

// app.set('view engine', 'ejs');

// app.use(bodyParser.urlencoded({extended: true}));
// app.use(express.static("public"));

// mongoose.connect("mongodb+srv://param2004:param3431@cluster0.zkgsb7i.mongodb.net/?retryWrites=true&w=majority");




// const itemsSchema = {
//     name: String
// };

// const Item = mongoose.model("Item", itemsSchema);

// const item1 = new Item({
//     name: "Task 1"
// });
// const item2 = new Item({
//     name: "Task 2"
// });
// const item3 = new Item({
//     name: "Task 3"
// });

// const dfltItms = [item1, item2, item3];



// const listSchema = {
//     name: String,
//     items: [itemsSchema]
// };

// const List = mongoose.model("List", listSchema);


// app.get("/", (req, res) => {
//     let day = date.getDay();
//     Item.find().then((items) => {
//         if(items.length === 0) {
//             Item.insertMany(dfltItms).then(() => {console.log("data inserted");
//             }).catch((err) => {
//                 console.log(err);
//             });
//             res.redirect("/");
//         } else {
//             res.render("list", {listTitle: day, newListItems: items});
//         }
//     }).catch((err) => {
//         console.log(err);
//     });
    
// });




// app.post("/", (req, res) => {
//     const item = req.body.newItem;
//     const list = req.body.list;
//     let day = date.getDay();

//     const itm = new Item({
//         name: item
//     });
    
//     if(list === day) {
//         itm.save();
//         res.redirect("/");
//     } else {
//         List.findOne({name: list}).then((found) => {
//             found.items.push(itm);
//             found.save();
//             res.redirect("/" + list)
//         })
//     }
// });



// app.post("/delete", (req, res) => {
//     const checkedoff = req.body.check;
//     const listName = req.body.listName;
//     let day = date.getDay();
//     if(listName === day){
//         Item.findByIdAndRemove(checkedoff).then(() => {
//             res.redirect("/");
//         }).catch((err) => {
//         console.log(err);
//         });
//     } else {
//         List.findOneAndUpdate({name: listName}, {$pull: {items: {_id: checkedoff}}}).then(() => {
//             res.redirect("/" + listName);
//         });
//     }
    
// });





// app.get("/:customList", (req, res) => {
//     const listName = _.capitalize(req.params.customList);

//     List.findOne({name: listName}).then((found) => {
//         if(!found) {
//             const list = new List({
//             name: listName,
//             items: dfltItms
//         });
//         list.save();
//         res.redirect("/" + listName);
//     } else {
//         res.render("list", {listTitle: found.name, newListItems: found.items});
//         }
//     }).catch((err) => {
//         console.log(err);
//     });

    
// });

// app.get("/about", (req, res) => {
//     res.render("about");
// });






// app.listen(port, () => {
//     console.log("Server is Running 😊👌");
// });