const express = require("express")
const router = express.Router()
const {newUser,updateProfilePhoto, verifiedUser,updateCoverPhoto, login,resetCode, reVerification,changePassword, findUser, verifyCode, getUser, updateDetails, addfriend, cancelRequest, follow, unFollow, acceptRequest, unFriend, deleteRequest, getAllFriends, search} = require("../../controllers/userController")
const { authUser } = require("../../middleware/auth")

router.post('/',newUser)
router.post('/activate',authUser,verifiedUser)
router.post('/login',login)
router.post('/reverification',authUser,reVerification)
router.post('/resetpassword',findUser)
router.post('/resetcode',resetCode)
router.post('/verifyresetcode',verifyCode)
router.post('/changepassword',changePassword)
router.get('/getuser/:username',authUser ,getUser)
router.put('/updateProfilePhoto',authUser ,updateProfilePhoto)
router.put('/updatecoverphoto',authUser ,updateCoverPhoto)
router.put('/updatedetails',authUser ,updateDetails)
router.put('/addfriend/:id',authUser ,addfriend)
router.put('/cancelrequest/:id',authUser ,cancelRequest)
router.put('/follow/:id',authUser ,follow)
router.put('/unfollow/:id',authUser ,unFollow)
router.put('/acceptrequest/:id',authUser ,acceptRequest)
router.put('/unfriend/:id',authUser ,unFriend)
router.put('/deleterequest/:id',authUser ,deleteRequest)
router.get('/getallfriends', authUser, getAllFriends)
router.post('/search/:searchTrem', authUser, search)











module.exports = router;