# karaoke-lyrics-card
A card for Home Assistant that shows the lyrics for the song that is currently playing.

This card has been designed to with with a liblrc server, you can also use the online liblrc api, I decided to host a local version of liblrc.

Example card usage:
```
type: custom:karaoke-lyrics-card
media_player: media_player.plex_plex_cast_chromecast
lrclib_server: 192.168.2.8:3300
adjustment_seconds: 0.5
```

| Parameter | Description | Default Value |
| --- | --- | --- |
| media_player | (Required) Media player entity that contains media attributes media_title, media_artist, and media_album_name, if you are using Plex pass in the plex media player entity. | None |
| lrclib_server | (Required) The address of the liblrc server excluding http, this should just be the IP and port, or domain name of the liblrc server. | None |
| adjustment_seconds | (Optional) If the lyrics are generally a little fast or slow at changing, you can use this parameter to provide an optional adjustment in seconds | 0 seconds |
