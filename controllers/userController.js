const Users = require("../models/userModel");
const Posts = require("../models/Post");
const {
  validateEmail,
  validateLength,
  validateUsername,
} = require("../helpers/validation");
const bcrypt = require("bcrypt");
const { jwToken } = require("../helpers/token");
const { sendVerifiedEmail, sendResetCode } = require("../helpers/mailer");
const jwt = require("jsonwebtoken");
const Code = require("../models/Code");
const { generateCode } = require("../helpers/generatCode");
const { response } = require("express");
const { firebaserules } = require("googleapis/build/src/apis/firebaserules");

//controller for create new user
exports.newUser = async (req, res) => {
  try {
    const {
      fName,
      lName,
      username,
      email,
      password,
      bMonth,
      bDay,
      bYear,
      verified,
      gender,
    } = req.body;
    // validation for first name
    if (!validateLength(fName, 3, 15)) {
      return res.status(400).json({
        message:
          "First name should be minimun length 3 and maximum length 15 characters",
      });
    }
    // validation for last name
    if (!validateLength(lName, 3, 15)) {
      return res.status(400).json({
        message:
          "Last name should be minimun length 3 and maximum length 15 characters",
      });
    }

    //  validation for email
    if (!validateEmail(email)) {
      return res.status(400).json({
        message: "Invalid email address",
      });
    }

    const checkMail = await Users.findOne({ email });

    if (checkMail) {
      return res.status(400).json({
        message: "Email is already exixts",
      });
    }

    // validation for password
    if (!validateLength(password, 3, 15)) {
      return res.status(400).json({
        message:
          "Password should be minimun length 6 and maximum length 20 characters",
      });
    }

    // bcrypt password
    const hashedPassword = await bcrypt.hash(password, 10);

    // validation username
    const tempUsername = fName + lName;
    const userName = await validateUsername(tempUsername);

    const user = await new Users({
      fName,
      lName,
      username: userName,
      email,
      password: hashedPassword,
      bMonth,
      bDay,
      bYear,
      verified,
      gender,
    }).save();

    const userToken = jwToken({ id: user._id.toString() }, "30m");

    const url = `${process.env.BASE_URL}/activate/${userToken}`;
    sendVerifiedEmail(user.email, user.fName, url);

    const token = jwToken({ id: user._id.toString() }, "7d");
    res.send({
      id: user._id,
      username: user.username,
      profilePicture: user.profilePicture,
      fName: user.fName,
      lName: user.lName,
      cover: user.cover,
      friends: user.friends,
      followers: user.followers,
      token: token,
      verified: user.verified,
      message: "Registration success: Please activate your email address",
    });
  } catch (error) {
    res.status(404).json({
      message: "Can't create User",
    });
  }
};

//controller for verified User
exports.verifiedUser = async (req, res) => {
  try {
    const verified = req.user.id;
    const { token } = req.body;
    const user = jwt.verify(token, process.env.JWT_SECRET);
    const check = await Users.findById(user.id);

    if (verified !== user.id) {
      return res.status(400).json({
        message: "You are not autthorization to complete this operation.",
      });
    }

    if (check.verified === true) {
      return res.status(400).json({
        message: "User already verified",
      });
    } else {
      await Users.findByIdAndUpdate(user.id, { verified: true });
      return res.status(200).json({
        message: "Account has been acctivated successfully",
      });
    }
  } catch (error) {
    res.status(404).json({
      message: "Can't not verify user",
    });
  }
};

// controller for login user
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await Users.findOne({ email });
    if (!user) {
      return res.status(400).json({
        message: "email not found please try again with correct email address",
      });
    }

    const checkPassword = await bcrypt.compare(password, user.password);
    if (!checkPassword) {
      return res.status(400).json({
        message: "Invalid credentials, please try again",
      });
    }

    const token = jwToken({ id: user._id.toString() }, "7d");

    res.send({
      id: user._id,
      username: user.username,
      profilePicture: user.profilePicture,
      fName: user.fName,
      lName: user.lName,
      cover: user.cover,
      friends: user.friends,
      followers: user.followers,
      token: token,
      verified: user.verified,
      message: "Login Successfully 🙋‍♂️",
    });
  } catch (error) {
    res.status(404).json({
      message: error.message,
    });
  }
};

// for verification

exports.reVerification = async (req, res) => {
  try {
    let id = req.user.id;
    const user = await Users.findById(id);
    if (user.verified === true) {
      return res.status(400).json({
        message: "This account is already verified",
      });
    }
    const userToken = jwToken({ id: user._id.toString() }, "30m");

    const url = `${process.env.BASE_URL}/activate/${userToken}`;
    sendVerifiedEmail(user.email, user.fName, url);
    return res.status(400).json({
      message: "Email verification link has been sent your account",
    });
  } catch (error) {
    res.status(404).json({
      message: "Can't not verify user",
    });
  }
};

// for find user

exports.findUser = async (req, res) => {
  try {
    const { email } = req.body;
    const matchEmail = await Users.findOne({ email }).select("-password");
    if (!matchEmail) {
      return res.status(404).json({
        message: "Email doesn't exist'",
      });
    }
    res.status(200).json({
      email: matchEmail.email,
      profilePicture: matchEmail.profilePicture,
    });
  } catch (error) {
    res.status(404).json({
      message: error.message,
    });
  }
};

// for reset code

exports.resetCode = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await Users.findOne({ email }).select("-password");
    await Code.findOneAndDelete({ user: user._id });
    const code = generateCode(5);
    const saveCode = await new Code({
      user: user._id,
      code,
    }).save();

    sendResetCode(user.email, user.fName, code);
    return res.status(200).json({
      message: "Reset code has been sent your email",
    });
  } catch (error) {
    res.status(404).json({
      message: error.message,
    });
  }
};

// for verifying code
exports.verifyCode = async (req, res) => {
  try {
    const { email, code } = req.body;
    const user = await Users.findOne({ email });
    const decode = await Code.findOne({ user: user._id });

    if (decode.code !== code) {
      return res.status(404).json({
        message: "Code doesn't match",
      });
    }
    return res.status(200).json({
      message: "thank you",
    });
  } catch (error) {
    res.status(404).json({
      message: error.message,
    });
  }
};
// change Password
exports.changePassword = async (req, res) => {
  try {
    const { email, password } = req.body;
    const cryptedPassword = await bcrypt.hash(password, 10);
    await Users.findOneAndUpdate({ email }, { password: cryptedPassword });
    return res.status(200).json({
      message: "Password Changed successfully✌️",
    });
  } catch (error) {
    res.status(404).json({
      message: error.message,
    });
  }
};


exports.getUser = async (req, res) => {
  try {
      const { username } = req.params
      const user = await Users.findById(req.user.id)
      const getProfile = await Users.findOne({ username }).select("-password")
      const friendShip = {
          friend: false,
          following: false,
          request: false,
          requestReceived: false
      }
      if (!getProfile) {
          return res.json({
              ok: false
          })
      }

      if (
          user.friends.includes(getProfile._id) &&
          getProfile.friends.includes(user._id)
      ) {
          friendShip.friend = true
      }

      if (user.following.includes(getProfile._id)) {
          friendShip.following = true
      }

      if (getProfile.request.includes(user._id)) {
          friendShip.request = true
      }

      if (user.request.includes(getProfile._id)) {
          friendShip.requestReceived = true
      }

      const posts = await Posts.find({ user: getProfile._id }).populate("user").populate("comments.commentedBy", "profilePicture username fName lName").sort({ createdAt: -1 })
      
      await getProfile.populate("friends", "fName lName username profilePicture")
 

      res.json({ ...getProfile.toObject(), posts, friendShip });

  } catch (error) {
      res.status(404).json({
          message: error.message
      })
  }
}


// for upload profile photo

exports.updateProfilePhoto = async (req, res) => {
  try {
    const { url } = req.body;
    await Users.findByIdAndUpdate(req.user.id, {
      profilePicture: url,
    });
    res.json(url);
  } catch (error) {
    res.status(404).json({
      message: error.message,
    });
  }
};

// for upload cover photo
exports.updateCoverPhoto = async (req, res) => {
  try {
    const { url } = req.body;
    await Users.findByIdAndUpdate(req.user.id, {
      cover: url,
    });
    res.json(url);
  } catch (error) {
    res.status(404).json({
      message: error.message,
    });
  }
};


exports.updateDetails = async (req, res) => {
  try {
      const { infos } = req.body
      const update = await Users.findByIdAndUpdate(req.user.id, {
          details: infos
      }, {
          new: true
      })
      res.send(update.details)
  } catch (error) {
      res.status(404).json({
          message: error.message
      })
  }
}


// add friend 
exports.addfriend = async (req,res)=>{
  try {
      if(req.user.id !== req.params.id){
        let sender = await Users.findById(req.user.id)
        let receiver = await Users.findById(req.params.id)

        if(!receiver.friends.includes(sender._id) && !receiver.request.includes(sender._id)){
          await receiver.updateOne({
            $push:{request:sender._id}
          })
          await receiver.updateOne({
            $push:{followers:sender._id}
          })
          await sender.updateOne({
            $push:{following:receiver._id}
          })
          res.json({message:"Friend request sent successfully"})
        }else{
          return res.json({message:"Allready Friend"})
        }
      }else{
        return res.json({
          message:"You can't send request to your self"
        })
      }
    
  } catch (error) {
    res.status(404).json({
      message: error.message
  })
  }
}

// cancle request 
exports.cancelRequest = async (req, res) => {
  try {
      if (req.user.id !== req.params.id) {
          let sender = await Users.findById(req.user.id)
          let receiver = await Users.findById(req.params.id)

          if (!receiver.friends.includes(sender._id) && receiver.request.includes(sender._id)) {
              await receiver.updateOne({
                  $pull: { request: sender._id }
              })
              await receiver.updateOne({
                  $pull: { followers: sender._id }
              })
              await sender.updateOne({
                  $pull: { following: receiver._id }
              })
              res.json({ message: "Cancel request" })
          } else {
              return res.json({ message: "Already canceled" })
          }
      } else {
          return res.json({
              message: "You can't cancel request to your self"
          })
      }
  } catch (error) {
      res.status(404).json({
          message: error.message
      })
  }
}

// user follow 
exports.follow = async (req, res) => {
  try {
      if (req.user.id !== req.params.id) {
          let sender = await Users.findById(req.user.id)
          let receiver = await Users.findById(req.params.id)

          if (!receiver.followers.includes(sender._id) && !sender.following.includes(receiver._id)) {
              await receiver.updateOne({
                  $push: { followers: sender._id }
              })
              await sender.updateOne({
                  $push: { following: receiver._id }
              })
              res.json({ message: "Successfully follow" })
          } else {
              return res.json({ message: "Already followed" })
          }
      } else {
          return res.json({
              message: "You can't follow your self"
          })
      }
  } catch (error) {
      res.status(404).json({
          message: error.message
      })
  }
}

// user unfollow 

exports.unFollow = async (req, res) => {
  try {
      if (req.user.id !== req.params.id) {
          let sender = await Users.findById(req.user.id)
          let receiver = await Users.findById(req.params.id)

          if (receiver.followers.includes(sender._id) && sender.following.includes(receiver._id)) {
              await receiver.updateOne({
                  $pull: { followers: sender._id }
              })
              await sender.updateOne({
                  $pull: { following: receiver._id }
              })
              res.json({ message: "Successfully unfollow" })
          } else {
              return res.json({ message: "Already unfollowed" })
          }
      } else {
          return res.json({
              message: "You can't unfollow your self"
          })
      }
  } catch (error) {
      res.status(404).json({
          message: error.message
      })
  }
}

// accept friend request 
exports.acceptRequest = async (req, res) => {
  try {
      if (req.user.id !== req.params.id) {
          let receiver = await Users.findById(req.user.id)
          let sender = await Users.findById(req.params.id)

          if (receiver.request.includes(sender._id)) {

              await Users.findByIdAndUpdate(receiver._id, {
                  $push: { friends: sender._id, following: sender._id }
              }, { new: true })

              await Users.findByIdAndUpdate(sender._id, {
                  $push: { friends: receiver._id, followers: receiver._id }
              }, { new: true })

              await receiver.updateOne({
                  $pull: { request: sender._id }
              })
              res.json({ message: "Request accepted" })
          } else {
              return res.json({ message: "Already friend" })
          }
      } else {
          return res.json({
              message: "You can't accept request your self"
          })
      }
  } catch (error) {
      res.status(404).json({
          message: error.message
      })
  }
}

// unfriend user 

exports.unFriend = async (req, res) => {
  try {
      if (req.user.id !== req.params.id) {
          let sender = await Users.findById(req.user.id)
          let receiver = await Users.findById(req.params.id)

          if (receiver.friends.includes(sender._id) && sender.friends.includes(receiver._id)) {
              await Users.findByIdAndUpdate(receiver._id, { $pull: { friends: sender._id, following: sender._id, followers: sender._id } }, { new: true })

              await Users.findByIdAndUpdate(sender._id, { $pull: { friends: receiver._id, following: receiver._id, followers: receiver._id } }, { new: true })

              res.json({ message: "Unfriend" })
          } else {
              return res.json({ message: "Already unfriend" })
          }
      } else {
          return res.json({
              message: "You can't unfriend your self"
          })
      }
  } catch (error) {
      res.status(404).json({
          message: error.message
      })
  }
}

// delete user request 

exports.deleteRequest = async (req, res) => {
  try {
      if (req.user.id !== req.params.id) {
          let receiver = await Users.findById(req.user.id)
          let sender = await Users.findById(req.params.id)

          if (receiver.request.includes(sender._id)) {
              await Users.findByIdAndUpdate(receiver._id, { $pull: { request: sender._id, followers: sender._id } }, { new: true })
              await sender.updateOne({
                  $pull: { following: receiver._id }
              })
              res.json({ message: "Request delete" })
          } else {
              return res.json({ message: "Already deleted" })
          }
      } else {
          return res.json({
              message: "You can't delete request your self"
          })
      }
  } catch (error) {
      res.status(404).json({
          message: error.message
      })
  }
}



exports.getAllFriends = async (req, res) => {
  try {
      const user = await Users.findById(req.user.id).select("friends request").populate("friends", "fName lName profilePicture username").populate("request", "fName lName profilePicture username")

      // if user sent request part
      const userSentRequest = await Users.find({
          request: req.user.id
      }).select("fName lName profilePicture username")

      res.json({
          friends: user.friends,
          request: user.request,
          sentRequest: userSentRequest
      })
  } catch (error) {
      res.status(404).json({
          message: error.message
      })
  }
}

// controller for search  
exports.search = async (req, res) => {
  try {
      const searchTerm = req.params.searchTerm;
      const search = await Users.find({ $text: { $search: searchTerm } }).select("fName lName username profilePicture")
      res.json(search)
  } catch (error) {
      res.status(404).json({
          message: error.message
      })
  }
}
