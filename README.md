# byzantime
REST API for access to parts of professional media files by media timing reference, mapping between bytes and time, hence _byzantime_.

This is a quick hack project to demonstrate how easy it is to use the Streampunk [kelvinadon](https://github.com/Streampunk/kelvinadon) MXF streaming library to create a RESTful API for accessing data in an MXF file. The RESTful API exposed is an example of the _bytes-to-time unwrap API_ illustrated as part of the [_Infinite Capacity Media Machine_](https://twitter.com/hashtag/InfCapMediaMachine?src=hash) and may form an input into the design of the _Content API_.

In summary, if you have an MXF file then its content is exposed via URLs like:

* <http://server.com/my_file.mxf/cable.json> - data about the elementary streams, including flow IDs, source IDs, start timestamp and technical description.
* <http://server.com/my_file.mxf/video_0/wire.json> - details about the first video track. Can be accessed by array index, track name or flow ID.
* <http://server.com/my_file,mxf/video[0]/12345678:040000000.raw> - Access to the raw data stored inside the MXF file by PTP timestamp for the given timestamp, relative to the material package creation time.
* <https://server.com/my_file.mxf/audio[1]/0-419.raw> - Access to the first 420 grains-worth of audio on audio track 1.

## Usage

### Installation

This is a [Node.JS](https://nodejs.org) project prepared for a recent LTS version v8.9.3 of node. A number of the latest ES6 features are used (async/await, generators) and so an up-to-date version of node is required.

Install this project using a git clone and run npm install to download the dependencies:

    git clone https://github.com/Streampunk/byzantime
    cd byzantime
    npm install

It is likely that byzantime will be published to NPM at some point so that if can be used as an installed application.

### Running

Byzantime assumes that you have a folder full of MXF files that you would like to access the elements of over RESTful paths. For example, `/media/my_mxf_files/`. In future, this could be updated to be a hierarchy of folders or an S3-style bucket containing MXF files. To run the server:

    node index.js /media/my_mxf_files

The server runs on port `3000`. Future versions will included a configuration parameter to set this.

### Things to try

Here is a typical pattern of requests you might like to make. The examples here are based on a folder containing [GrassValley's example MXF files](http://www.gvgdevelopers.com/concrete/products/k2/test_clips/).

#### List all the files

`http://localhost:3000`

```JSON
[
  "NTSC_1080i_AVC-I_colorbar.mxf",
  "NTSC_1080i_DVCPRO_HD_colorbar.mxf",
  "NTSC_1080i_MPEG_IFrame_colorbar.mxf",
  "NTSC_1080i_MPEG_LGOP_colorbar.mxf",
  "NTSC_1080i_MPEG_XDCAM-EX_colorbar.mxf",
  " ... more MXF files ..."
]
```

#### Details of a file (debug use only)

Basic fsstat details for the file.

`http://localhost:3000/NTSC_1080i_MPEG_LGOP_colorbar.mxf`

```JSON
{
   "file" : "/Volumes/raid/media/streampunk/gv/NTSC_1080i_MPEG_LGOP_colorbar.mxf",
   "material" : {},
   "index" : {},
   "indexed" : true,
   "indexing" : {},
   "access" : 4,
   "fileStat" : {
      "blocks" : 48616,
      "ctimeMs" : 1466028033000,
      "atime" : "2018-02-02T21:53:05.000Z",
      "birthtimeMs" : 1466027475000,
      "blksize" : 4096,
      "dev" : 16777225,
      "ctime" : "2016-06-15T22:00:33.000Z",
      "mtime" : "2016-06-15T22:00:33.000Z",
      "mode" : 33188,
      "rdev" : 0,
      "mtimeMs" : 1466028033000,
      "size" : 24888904,
      "uid" : 501,
      "nlink" : 1,
      "ino" : 81301897,
      "atimeMs" : 1517608385000,
      "birthtime" : "2016-06-15T21:51:15.000Z",
      "gid" : 20
   },
   "streams" : {}
}
```

#### View the file as a cable

The Infinite Capacity Media Machine considers all content sources to be a kind of _logical cable_ that can be plugged into a number of destinations. The _cable_ (derived from the MXF _material package_) contains a number of _wires_ (MXF _tracks_) of different types, some video, some audio, some event-based and some data. Each wire has an NMOS flow ID, source ID, name and technical description. The technical description used here is a JSON serialization of the SMPTE EssenceDescription associated with each wire.

The `start` time is the PTP value of the creation time of the associated source package and all timestamps for the derived streams start counting up from this value.

`http://localhost:3000/NTSC_1080i_MPEG_LGOP_colorbar.mxf/cable.json`

```JSON
{
   "audio" : [],
   "id" : "2e1b3bc6-5614-141e-4fe7-00b00901b339",
   "video" : [
      {
         "flowID" : "5e527be0-382f-5589-af5e-92f06ed601d7",
         "tags" : {
            "grainDuration" : [
               1001,
               30000
            ]
         },
         "start" : "1293542953:768000000",
         "baseTime" : [
            1293542953,
            768000000
         ],
         "sourceID" : "3519f87d-489c-528d-91d2-61e7839c22e7",
         "indexRef" : "2-15010500",
         "description" : {
            "ContainerFormat" : "MXFGCFrameWrappedMPEGESVideoStream0SID",
            "FrameLayout" : "SeparateFields",
            "InstanceID" : "2e1bb2cc-5614-141e-1d2f-00b00901b339",
            "DisplayF2Offset" : 0,
            "PictureCompression" : "MPEG2422PHLLongGOP",
            "StoredF2Offset" : 0,
            "MaxBPictureCount" : 2,
            "SampledWidth" : 1920,
            "ObjectClass" : "MPEGVideoDescriptor",
            "ProfileAndLevel" : 130,
            "HorizontalSubsampling" : 2,
            "VerticalSubsampling" : 1,
            "DisplayWidth" : 1920,
            "SampledHeight" : 544,
            "ComponentDepth" : 8,
            "BitRate" : 25000000,
            "MaxGOP" : 15,
            "LinkedTrackID" : 19,
            "DisplayXOffset" : 0,
            "VideoLineMap" : [
               21,
               584
            ],
            "SampledYOffset" : 0,
            "SampleRate" : [
               30000,
               1001
            ],
            "StoredHeight" : 544,
            "StoredWidth" : 1920,
            "ImageAspectRatio" : [
               16,
               9
            ],
            "DisplayHeight" : 540,
            "ActiveFormatDescriptor" : 0,
            "ClosedGOP" : true,
            "SampledXOffset" : 0,
            "DisplayYOffset" : 0
         },
         "name" : "video_19"
      }
   ]
}
```


## Status, support and further development

This is prototype software that is not yet suitable for production use. The software is a hack project and may stop of be deleted at any time.

Contributions can be made via pull requests and will be considered by the author on their merits. Enhancement requests and bug reports should be raised as github issues. For support, please contact [Streampunk Media](https://www.streampunk.media/). For updates follow [@StrmPunkd](https://twitter.com/StrmPunkd) on Twitter.

## License

This software is released under the Apache 2.0 license. Copyright 2018 Streampunk Media Ltd.
