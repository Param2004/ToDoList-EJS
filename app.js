const express = require("express");
const bodyParser = require("body-parser");
const date = require(__dirname + "/date.js");
const mongoose = require("mongoose");
const _ = require("lodash");
const port = process.env.PORT || 3001;

const app = express();

app.set('view engine', 'ejs');

app.use(bodyParser.urlencoded({extended: true}));
app.use(express.static("public"));

mongoose.connect("mongodb+srv://param2004:param3431@cluster0.zkgsb7i.mongodb.net/?retryWrites=true&w=majority");




const itemsSchema = {
    name: String
};

const Item = mongoose.model("Item", itemsSchema);

const item1 = new Item({
    name: "believe in yourself"
});
const item2 = new Item({
    name: "trust your lovd onc"
});
const item3 = new Item({
    name: "respect ur eldrs"
});

const dfltItms = [item1, item2, item3];



const listSchema = {
    name: String,
    items: [itemsSchema]
};

const List = mongoose.model("List", listSchema);


app.get("/", (req, res) => {
    let day = date.getDay();
    Item.find().then((items) => {
        if(items.length === 0) {
            Item.insertMany(dfltItms).then(() => {console.log("data inserted");
            }).catch((err) => {
                console.log(err);
            });
            res.redirect("/");
        } else {
            res.render("list", {listTitle: day, newListItems: items});
        }
    }).catch((err) => {
        console.log(err);
    });
    
});




app.post("/", (req, res) => {
    const item = req.body.newItem;
    const list = req.body.list;
    let day = date.getDay();

    const itm = new Item({
        name: item
    });
    
    if(list === day) {
        itm.save();
        res.redirect("/");
    } else {
        List.findOne({name: list}).then((found) => {
            found.items.push(itm);
            found.save();
            res.redirect("/" + list)
        })
    }
});



app.post("/delete", (req, res) => {
    const checkedoff = req.body.check;
    const listName = req.body.listName;
    let day = date.getDay();
    if(listName === day){
        Item.findByIdAndRemove(checkedoff).then(() => {
            res.redirect("/");
        }).catch((err) => {
        console.log(err);
        });
    } else {
        List.findOneAndUpdate({name: listName}, {$pull: {items: {_id: checkedoff}}}).then(() => {
            res.redirect("/" + listName);
        });
    }
    
});





app.get("/:customList", (req, res) => {
    const listName = _.capitalize(req.params.customList);

    List.findOne({name: listName}).then((found) => {
        if(!found) {
            const list = new List({
            name: listName,
            items: dfltItms
        });
        list.save();
        res.redirect("/" + listName);
    } else {
        res.render("list", {listTitle: found.name, newListItems: found.items});
        }
    }).catch((err) => {
        console.log(err);
    });

    
});

app.get("/about", (req, res) => {
    res.render("about");
});






app.listen(port, () => {
    console.log("Server is Running 😊👌");
});