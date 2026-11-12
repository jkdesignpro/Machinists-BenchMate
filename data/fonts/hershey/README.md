# Hershey fonts (stroke fonts for text engraving)

The nine `.svg` files in this folder are the Hershey fonts as SVG font files.
BenchMate's text engraving page reads them as they are. They are not
BenchMate's work and they are not under BenchMate's licence: each file
carries its own use notice in its `<metadata>` block, repeated here.

## Use notice (from each file)

> The Hershey Fonts are a set of vector fonts with a liberal license.
>
> USE RESTRICTION:
> This distribution of the Hershey Fonts may be used by anyone for
> any purpose, commercial or otherwise, providing that:
>
> 1. The following acknowledgements must be distributed with
>    the font data:
>    - The Hershey Fonts were originally created by Dr.
>      A. V. Hershey while working at the U. S.
>      National Bureau of Standards.
>    - The format of the Font data in this distribution
>      was originally created by
>      James Hurt
>      Cognition, Inc.
>      900 Technology Park Drive
>      Billerica, MA 01821
>      (mit-eddie!ci-dandelion!hurt)
> 2. The font data in this distribution may be converted into
>    any other format *EXCEPT* the format distributed by
>    the U.S. NTIS where each point is described
>    in eight bytes as "xxx yyy:", where xxx and yyy are
>    the coordinate values as ASCII numbers.

Each file also says: "Originally prepared in 2011 and converted to SVG fonts
in 2019 by Windell H. Oskay, www.evilmadscientist.com. Contents adapted from
emergent.unpythonic.net/software/hershey by way of 'Hershey Fonts in SVG' by
Marty McGuire, http://www.thingiverse.com/thing:6168".

## Where the files came from

Copied unchanged on 2026-11-12 from the Inkscape 1.2.2 package (Ubuntu
`inkscape 1.2.2-2ubuntu12`, folder `share/inkscape/extensions/svg_fonts`),
where they are the fonts of the Hershey Text extension. Only the nine Hershey
fonts were taken. The other fonts in that folder (the EMS fonts, under the SIL
Open Font License) are not included.

| File | Name in the file | SHA-256 (first 16 hex digits) |
|---|---|---|
| HersheySans1.svg | Hershey Sans 1-stroke | 974ece72c9dfaddc |
| HersheySansMed.svg | Hershey Sans medium | b77806497fe2f335 |
| HersheySerifMed.svg | Hershey Serif medium | 1600b5917748c29e |
| HersheySerifMedItalic.svg | Hershey Serif medium italic | 9b682198c664cd66 |
| HersheySerifBold.svg | Hershey Serif bold | 7d81ac6c2e667262 |
| HersheySerifBoldItalic.svg | Hershey Serif bold italic | 0747fd08e445de84 |
| HersheyScript1.svg | Hershey Script 1-stroke | 79e49e3200441c54 |
| HersheyScriptMed.svg | Hershey Script medium | b6213eb16ee80abb |
| HersheyGothEnglish.svg | Hershey Gothic English | d0e04161e4193b9f |

## What was checked

- The use notice above is in every one of the nine files.
- The same notice is published on the Fedora licensing wiki ("Hershey font
  licence", https://fedoraproject.org/wiki/Licensing/HersheyFontLicense, read
  2026-11-12), which gives the Ghostscript documentation as its source.
- Not read: the README of the upstream font collection
  (https://gitlab.com/oskay/svg-fonts). The site does not let BenchMate's
  research tool read it. The notice inside each file is what BenchMate relies
  on.
- BenchMate does not convert the data into the NTIS format the notice rules
  out. It reads the SVG files as they are and keeps the strokes in memory.

## Rules for this folder

- Do not edit the files. To change a letter, add a new font file with its own
  notice instead.
- Keep this README and the notice inside each file with the fonts wherever
  they are shipped. `scripts/build-web.sh` copies the files, notice included,
  to `app/data/fonts/`, and the engraving page prints the acknowledgements.
