// functions to send data to Azure to predict based on image

import React from "react";
import { Text, View, ImageStore, Vibration } from "react-native";

// require("dotenv").config();

// import {
//   REACT_APP_CLIENT_ID,
//   PREDICTION_KEY,
//   PREDICTION_URL,
//   CONTENT_TYPE,
// } from "@env";

let REACT_APP_CLIENT_ID = process.env.REACT_APP_CLIENT_ID;
let PREDICTION_KEY = process.env.PREDICTION_KEY;
let PREDICTION_URL = process.env.PREDICTION_URL;
let CONTENT_TYPE = process.env.CONTENT_TYPE;

// REACT_APP_CLIENT_ID=0a3d2bd65d89e8e
// REACT_APP_CLIENT_SECRET=f6a7821e20e019e464ea402d3c8531e707b0f71d

// PREDICTION_URL=https://northcentralus.api.cognitive.microsoft.com/customvision/v3.0/Prediction/0bd36f77-e0bd-4ddf-a9ac-885ad5a02294/classify/iterations/Iteration2/image
// PREDICTION_KEY=d397fe879edd433494726fab25579bee
// CONTENT_TYPE=application/octet-stream

// import { Camera } from "expo-camera";
// import { Permissions } from "expo-permissions";
// import { FileSystem } from "expo-file-system";
// import { ImageManipulator } from "expo-image-manipulator";
import {
  Camera,
  Permissions,
  FileSystem,
  Constants,
  ImageManipulator,
} from "expo";

export default class PredictFromCamera extends React.Component {
  static navigationOptions = {
    header: null,
  };
  state = {
    tagText: DEFAULT_TAG_TEXT,
    flash: "off",
    zoom: 0,
    autoFocus: "on",
    depth: 0,
    ratio: "16:9",
    ratios: [],
    photoId: 1,
    photoIdTag: 1,
    whiteBalance: "auto",
    hasCameraPermission: null,
    type: Camera.Constants.Type.back,
  };

  async componentWillMount() {
    const { status } = await Permissions.askAsync(Permissions.CAMERA);
    this.setState({ hasCameraPermission: status === "granted" });
  }

  componentWillUnmount() {
    clearInterval(this.resetPredictionInterval);
  }

  async componentDidMount() {
    var file_info = await FileSystem.getInfoAsync(
      FileSystem.documentDirectory + "photos"
    );
    if (!file_info.exists) {
      FileSystem.makeDirectoryAsync(
        FileSystem.documentDirectory + "photos"
      ).catch((e) => {
        console.log(e, "Directory exists");
      });
    }
  }

  // Takes picture, then calls sendToImgur
  async takePicture() {
    var photoLoc = `${FileSystem.documentDirectory}photos/Photo_${this.state.photoId}_Base64`;
    if (this.camera) {
      let photo = await this.camera.takePictureAsync({ base64: true });
      FileSystem.moveAsync({
        from: photo.uri,
        to: photoLoc,
      }).then(() => {
        this.setState({
          photoId: this.state.photoId + 1,
        });
        this.sendToImgur(photoLoc);
      });
    }
  }

  // Downsizes photo and uses Imgur API to
  // get a web url of photo, sends to Prediction API
  // (calls sendToMicrosoftPrediction)
  async sendToImgur(photoLoc) {
    try {
      // Use Image Manipulator to downsize image
      let manipulatedObj = await ImageManipulator.manipulateAsync(
        photoLoc,
        [{ resize: { width: 200 } }],
        { base64: true }
      );
      var xmlHttp = new XMLHttpRequest();
      const data = new FormData();
      xmlHttp.onreadystatechange = (e) => {
        if (xmlHttp.readyState == 4) {
          if (xmlHttp.status === 200) {
            // Send Imgur link to photo to be sent to Prediction API
            let imgur_json = JSON.parse(xmlHttp.responseText);
            this.sendToMicrosoftPrediction(imgur_json.data.link);
          } else {
            // Debug errors
            console.log(xmlHttp.responseJson);
          }
        }
      };
      xmlHttp.open("POST", "https://api.imgur.com/3/upload", true);
      xmlHttp.setRequestHeader(
        "Authorization",
        "Client-ID " + "0a3d2bd65d89e8e"
      );
      data.append("type", "base64");
      data.append("image", manipulatedObj.base64);
      xmlHttp.send(data);
    } catch (error) {
      console.error(error);
    }
  }

  // Uses Prediction API to process photo at a web url
  // and calls setNewPrediction
  async sendToMicrosoftPrediction(img_url) {
    let response = await fetch(
      "https://northcentralus.api.cognitive.microsoft.com/customvision/v3.0/Prediction/0bd36f77-e0bd-4ddf-a9ac-885ad5a02294/classify/iterations/Iteration2/image",
      {
        method: "POST",
        headers: {
          "Prediction-Key": "d397fe879edd433494726fab25579bee",
          "Content-Type": "application/octet-stream",
        },
        body: JSON.stringify({
          Url: img_url,
        }),
      }
    );
    let bodyText = JSON.parse(response["_bodyText"]);
    let predictions = bodyText["predictions"];
    this.setNewPrediction(predictions);
  }

  // Sets tagText to most probable tag
  setNewPrediction(predictions) {
    let maxProb = 0;
    let bestTag = "None";
    for (let predMap of predictions) {
      if (predMap.probability > maxProb) {
        maxProb = predMap.probability;
        bestTag = predMap.tagName;
      }
    }
    // Vibration.vibrate();
    // // To give our app more personality, we created arrays of funny responses and chose
    // // a random response depending on what the tag was. Removed from this version
    // // to accommodate any named tags
    this.setState({
      tagText: `AI says: ${bestTag}\nProbability: ${maxProb.toString()}`,
    });
    this.resetPredictionInterval = setInterval(
      this.resetPredictionText.bind(this),
      20000
    );
  }

  resetPredictionText() {
    this.setState({
      tagText: DEFAULT_TAG_TEXT,
    });
  }

  render() {
    const { hasCameraPermission } = this.state;
    if (hasCameraPermission === null) {
      return <View />;
    } else if (hasCameraPermission === false) {
      return <Text>No access to camera</Text>;
    } else {
      return (
        <Camera
          ref={(ref) => {
            this.camera = ref;
          }}
          style={{ flex: 1 }}
          type={this.state.type}
          flashMode={this.state.flash}
          autoFocus={this.state.autoFocus}
          zoom={this.state.zoom}
          whiteBalance={this.state.whiteBalance}
          ratio={this.state.ratio}
          focusDepth={this.state.depth}
        >
          <View style={styles.cameraView}>
            <View style={styles.tagTextView}>
              <Text style={styles.textStyle}>{this.state.tagText}</Text>
            </View>
            <View style={styles.buttonContainerView}>
              <Button
                title="Cute or not?"
                onPress={() => {
                  clearInterval(this.resetPredictionInterval);
                  this.takePicture();
                  this.setState({
                    tagText: "Thinking...",
                  });
                }}
              />
            </View>
          </View>
        </Camera>
      );
    }
  }
}

const styles = {
  cameraView: {
    display: "flex",
    flex: 1,
    flexDirection: "column",
    justifyContent: "space-between",
    alignItems: "stretch",
    backgroundColor: "transparent",
  },
  tagTextView: {
    backgroundColor: "white",
    height: 90,
    margin: 20,
    marginTop: 30,
    borderRadius: 4,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  buttonContainerView: {
    backgroundColor: "transparent",
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    alignSelf: "stretch",
    marginLeft: 20,
    marginRight: 20,
    marginBottom: 10,
  },
  textStyle: {
    color: "black",
    fontSize: 19,
    textAlign: "center",
  },
};
