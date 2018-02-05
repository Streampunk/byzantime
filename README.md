# byzantime
REST API for access to parts of professional media files by media timing reference, mapping between bytes and time, hence _byzantime_.

This is a quick hack project to demonstrate how easy it is to use the Streampunk [kelvinadon](https://github.com/Streampunk/kelvinadon) MXF streaming library to create a RESTful API for accessing data in an MXF file. The RESTful API exposed is an example of the _bytes-to-time unwrap API_ illustrated as part of the [_Infinite Capacity Media Machine_](https://twitter.com/hashtag/InfCapMediaMachine?src=hash) and may form an input into the design of the _Content API_.

In summary, if you have an MXF file then its content is exposed via URLs like:

* <http://server.com/my_file.mxf/cable.json> - data about the elementary streams, including flow IDs, source IDs, start timestamp and technical description.
* <http://server.com/my_file.mxf/video[0]/wire.json> - details about the first video track. Can be accessed by array index, track name or flow ID.
* <http://server.com/my_file,mxf/video[0]/123456789:040000000.raw> - Access to the raw data stored inside the MXF file by PTP timestamp for the given timestamp, relative to the material package creation time.
* <http://server.com/my_file.mxf/video[0]/123456789:040000000-123456789:160000000.json> - Details about a range of frames between the timestamps, including their byte offsets. (Will include GOP-finding information.)
* <http://server.com/my_file.mxf/audio[1]/0-419.raw> - Access to the first 420 grains-worth of audio on audio track 1.

Certain types of media can be played directly in [VLC](https://www.videolan.org/index.en-GB.html) using the `Open Network` option, downloaded or piped with [curl](https://curl.haxx.se/) into [ffmpeg](https://www.ffmpeg.org/) or, with appropriate parameters, imported into [Audacity](https://www.audacityteam.org/) as raw.

## Usage

### Installation as a command

Install byzantime globally as follows (use `sudo` if required):

    npm install -g byzantime

Run the server as follows:

    byzantime -p 3000 /media/my_mxf_files

By default, the server runs on port `3000` and can be configured with the `-p` option.

### Installation via github

This is a [Node.JS](https://nodejs.org) project prepared for a recent LTS version v8.9.3 of node. A number of the latest ES6 features are used (async/await, generators) and so an up-to-date version of node is required.

Install this project using a git clone and run npm install to download the dependencies:

    git clone https://github.com/Streampunk/byzantime
    cd byzantime
    npm install

It is likely that byzantime will be published to NPM at some point so that if can be used as an installed application.

Byzantime assumes that you have a folder full of MXF files that you would like to access the elements of over RESTful paths. For example, `/media/my_mxf_files/`. In future, this could be updated to be a hierarchy of folders or an S3-style bucket containing MXF files. To run the server:

    node index.js -p 3000 /media/my_mxf_files

By default, the server runs on port `3000` and can be configured with the `-p` option.

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
   ],
   "audio" : [ " ... details of the audio tracks ..."],
}
```

Then details of each track can be accessed at sub-resources, with the track name, track type and index and flow ID being equivalent, for example:

* By flow ID: <http://localhost:3000/NTSC_1080i_MPEG_LGOP_colorbar.mxf/5e527be0-382f-5589-af5e-92f06ed601d7/wire.json>
* By name:<http://localhost:3000/NTSC_1080i_MPEG_LGOP_colorbar.mxf/video_19/wire.json>
* By type and index: <http://localhost:3000/NTSC_1080i_MPEG_LGOP_colorbar.mxf/video[0]/wire.json>

#### Grains, grains, grains

To access the raw data wrapped inside the MXF file, use PTP timestamps or grain indexes.
It is possible to access the data for one grain or a range of grains. In the case of a range of grains, a separate resource gives access to the byte offsets for the start of each grain. All grains are delivered with (arachnid)[https://github.com/Streampunk/arachnid] headers.

For example, access the 42nd frame in our example file:

`http://localhost:3000/NTSC_1080i_MPEG_LGOP_colorbar.mxf/video_19/42.raw`

```
< HTTP/1.1 200 OK
< X-Powered-By: Express
< Content-Length: 7424
< Content-Type: application/octet-stream
< Arachnid-PTPOrigin: 1293542955:169400000
< Arachnid-PTPSync: 1293542955:169400000
< Arachnid-FlowID: 5e527be0-382f-5589-af5e-92f06ed601d7
< Arachnid-SourceID: 3519f87d-489c-528d-91d2-61e7839c22e7
< Arachnid-GrainDuration: 1001/30000
< Arachnid-GrainCount: 1
< Date: Mon, 05 Feb 2018 13:13:00 GMT
< Connection: keep-alive
<
{ [7424 bytes data]
```

Note that `Content-Type` is fixed as `application/octet-stream` and will be enhanced in the future more precisely describe the body.

Too access a range of grains, use an inclusive range e.g. `42-47.raw`. For some codecs, the grains are of different byte lengths. To find the start of each grain within the data returned, use `.json` instead of `.raw`.

`http://localhost:3000/NTSC_1080i_MPEG_LGOP_colorbar.mxf/video_19/42-47.json`

```JSON
[
   {
      "timestamp" : "1293542955:169400000",
      "position" : 0,
      "length" : 7424,
      "type" : "raw"
   },
   {
      "timestamp" : "1293542955:202766666",
      "position" : 7424,
      "length" : 5120,
      "type" : "raw"
   },
   {
      "timestamp" : "1293542955:236133333",
      "length" : 6656,
      "position" : 12544,
      "type" : "raw"
   },
   {
      "timestamp" : "1293542955:269500000",
      "position" : 19200,
      "length" : 148736,
      "type" : "raw"
   },
   {
      "timestamp" : "1293542955:302866666",
      "length" : 6400,
      "position" : 167936,
      "type" : "raw"
   },
   {
        "timestamp" : "1293542955:336233333",
      "position" : 174336,
      "length" : 5376,
      "type" : "raw"
   }
]
```

The `timestamp`s show the PTP timestamp that can be used to access the grain. The `position` is the byte offset of the grain within the data stream returned. The `length` is the number of bytes in the grain. The `type` will be improved with GOP information to allow applications to find I-frame/IDR grains that they can start playing from.

You get the same result from the following URL, using a timestamp range.

`http://localhost:3000/NTSC_1080i_MPEG_LGOP_colorbar.mxf/video[0]/1293542955:169300000-1293542955:336433333.json`

Note that the time stamp matching is slightly `fuzzy` to allow for slight rounding errors, with a margin plus or minus around 10% of the grain duration.

### Wait for it ...

Byzantime builds a grain index of the byte offsets into the file of any of the contained values. This is done just-in-time, so to access grains further through the file it may be necessary to wait until indexing is completed. The following message will be received if trying to access grains beyond the current index point:

```JSON
{
  "status": 400,
  "message": "Still indexing."
}
```

## Names, timestamps and IDs

The names of each wire are derived from their type and MXF `TrackID` property.

Identifiers are generated as follows:

* The cable identifier is the last 16 bytes of the MXF `PackageID` for the primary package of the MXF file.
* The flow identifiers are derived by taking the same identifier as the cable and using this as a namespace for a v5 UUID. The name used is `Track`_TrackID_, for example `Track19`.
* Similarly, the source identifiers are derived by taking the last 16 bytes of `PackageID` of the related original source package identifier - the end of the source reference chain - as the namespace for a v5 UUID. The name used is `Track`_TrackID_, for example `Track19`.

In this way, if the same original source package appears in two files, the identifiers should be the same.

For time references, PTP references start at the creation time of the material package for the first grain and increment at the sample rate. Timestamps may be adjusted from origin offsets.

## Status, support and further development

This is prototype software that is not yet suitable for production use. The software is a hack project and may stop of be deleted at any time. It is hoped to extend the API to include support for IMF bundles and writing MXF files.

Contributions can be made via pull requests and will be considered by the author on their merits. Enhancement requests and bug reports should be raised as github issues. For support, please contact [Streampunk Media](https://www.streampunk.media/). For updates follow [@StrmPunkd](https://twitter.com/StrmPunkd) on Twitter.

## License

This software is released under the Apache 2.0 license. Copyright 2018 Streampunk Media Ltd.
