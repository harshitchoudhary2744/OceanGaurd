// Authentic Precomputed DARTIS Benchmark Transparent Raster Masks (Base64 PNG)
// Generated from Sentinel-1 Ground Truth Masks (apps/api/ml/true_mask)
// 100% transparent ocean background + glowing Rose-500 oil slick (rgba(244, 63, 94, 245))

export interface DartisBenchmarkInfo {
  datasetKey: string;
  title: string;
  sceneId: string;
  imagePath: string;
  maskPath: string;
  areaSqKm: number;
  perimeterKm: number;
  eccentricity: number;
  dampingRatioDb: number;
  segmentationDiceScore: number;
  segmentationIouScore: number;
  maxProbability: number;
  oilLikelihoodScore: number;
  lookalikeScore: number;
  confidenceScore: number;
  center: [number, number];
  location: string;
  acquisitionStartUtc: string;
  acquisitionStartIst: string;
  sentinelProduct: string;
  estimatedDischargeLiters: number;
  classProbabilities: Record<string, number>;
  polygonCoordinates: number[][];
}

export const DARTIS_MASKS: Record<string, string> = {
  "ow-0001": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAQAAAAEACAYAAABccqhmAAABmElEQVR4nO3csQnCQBiG4VMQR7F3jfTukdra2j3sXSN9RglpxAkS4dCc3/M0aUI4Av/LX10pAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB/aPfrA9CGub89lt453K+X75yGWvbVvkT08H/yHtthA2DVUE/D2C39quP59Hw/bQLtsAFAMAGAYAIAwQQAggkABBMACCYAEEwAIJgAQDABgGACAMEEAIIJAAQTAAgmABBMACCYAEAwNwJR9aovtwG1xQZAtaE2/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAlC14AUn6GCpvAtPQAAAAAElFTkSuQmCC",
  "ow-0002": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAQAAAAEACAYAAABccqhmAAABpUlEQVR4nO3doa0CQRRA0YWEUAqeNvD08TUaTR942sBTCsGQLyiATWCBe45Zs5OMeTfPzTAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAKTNpr4A73X72x+f+X9x2G1fdxumNp/6Anzu8I89w/ewAUQ8Bvl6vmyeObdcr07/X5vAb7IBQJgAQJgAQJgAQJgAQJgAQJgAQJgAQJgAQJgAQJgAQJgAQJgAQJgAQJgAQJgAQJgAQJgAQJgAQJgAQJgAQJgAQJgAQJh3AULGPvLhTYDfZQMIGTPIhh8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgOHb3AE6wxg2A+p4PAAAAABJRU5ErkJggg==",
  "ow-0003": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAQAAAAEACAYAAABccqhmAAABg0lEQVR4nO3asQ3CMBAFUBMJMUr6rEHPHtTU1NkjfdZIn1EQDaJgA1sxd+817k5u/tcVVwoAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADAvzkd/QHaed+fS61Z5/lxqzWLfgxHf4D+w99iHn2wAQT0C+tr26+1Zl6mcf2+NoFYbACQmAKAxBQAJKYAIDEFAIkpAEhMAUBi7gCCanG44wYgHhtAULXDKvwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAlC58ACb8GBZrRCG8AAAAAElFTkSuQmCC",
  "ow-0004": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAQAAAAEACAYAAABccqhmAAACRUlEQVR4nO3aPWoCURhAUQ2IS7HPNtK7D2tra/dhn23YZyliEyyEIP4VEh3vOc2A85Bpvstj3oxGAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAb2/87AdgOPaL1eb0t8l6OX/O0/AIHw/5F5LDf+13hsEOgJuOQ77b/nyd3pt+zr4PVzuBYbIDgDABgDABgDABgDABgDABgDDHgFGn5/e3jvGunfc7AhwuO4Cgc8N864OeS0Nu+IfNDiDm0kc9PuhpsgOAMAGAMAGAMO8Agi698PNCr8cOIOjcoBt+AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA4A7jexYBw7JfrDbX7k/Wy/nh+vFvTwS8xPD/XWMHAG/kONi77c/XtXXTz9n34WoHAGECAGECAGECAGECAGECAGECAGECAGECAGECAGECAGECAGECAGECAGECAGECAGECAGECAGECAGECAGECAGECAGECAGECAGECAGECAGECAGECAGECAGECAGECAGECAGECAGECAGECAGECAGECAGECAGECAGECAGHjZz8A8Fj7xWpzz7rJejm3A4A3cxjsR6wBAAAAAAAAAAAAAABGL+cXcX9HEMJSpDQAAAAASUVORK5CYII=",
  "ow-0005": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAQAAAAEACAYAAABccqhmAAAB/0lEQVR4nO3cMW7CQBQEUAclylHocw167pE6NTX3oOca9DkKSoNcJgV22JW97LzXUBmtkP5oZH12GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADK9rH0A2vbzeTg98tzb8Wtf/zTUtqn+jQzpw1/6LMvRALg7wNfL9+6Rn+j9Y3sePzWBtmkAEEwAQDABAMEEAAQTABBMAEAwAQDBBAAEEwAQzCZgx+6t487Z0Ctd57UF2D4NoFNTwztnuEsG2PA/Bw0gdI/frj4jDQCCCQAIJgAg2OvaB+A3b95ZkgbQkBq36LiJh//QADq5gefv232YQwOAYBpAx6bagGUdNIBOTQ234WekAXTMkDNFA4BgAgCCCQAIJgAgmACAYAIAggkACCYAIJgAgGDuBGxIrb/y2gBkLg2gITUG1/ADAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMBQ5AbWuUbG0e+PlwAAAABJRU5ErkJggg==",
  "ow-0006": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAQAAAAEACAYAAABccqhmAAADa0lEQVR4nO3cMVIiQRiAUdiS4ijmXsOcexATE3MPcq9h7lEski0CUsvdAmamv/cSQpuumY9fbWa1AgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAICq9WoQl/3xPPUa5mZzOuymXgPz9mc1ADe/fSE6Adxu/u/Pr/ep1zI327fXj+urSYChJwDg/wgAhAkAhAkAhAkAhAkAhAkAhAkAhAkAhAkAhAkAhAkAhAkAhAkAhAkAhAkAhAkAhAkAhAkAhAkAhAkAhAkAhAkAhAkAhAkAhAkAhAkAhAkAhAkAhAkAhAkAhAkAhAkAhAkAhAkAhAkAhAkAhAkAhAkAhAkAhAkAhAkAhAkAhAkAhAkAhAkAhAkAhAkAhAkAhAkAhAkAhAkAhAkAhAkAhAkAhAkAhAkAhAkAhAkAhAkAhAkAhAkAhAkAhAkAhAkAhAkAhAkAhAkAhAkAhAkAhAkAhAkAhAkAhAkAhAkAhAkAhAkAhAkAhAkAhAkAhAkAhAkAhAkAhAkAhAkAhAkAhAkAhAkAhAkAhAkAhAkAhAkAhAkAhAkAhAkAhAkAhAkAhAkAhAkAhAkAhAkAhAkAhAkAhAkAhAkAhK1XA7jsj+ep1zBXm9NhN/UamK8hJgAXuX0BAAAAAABguHMAPP9cxNL/9XqvPdosfB+GOAfA8w9FLfnw1T3XflnwPlyZAAZyuxi/P7/eH/2ztm+vH0v8BLz3Hm0Xug83JgAIEwAIEwAIEwAIEwAIEwAIEwAIEwAIEwAIEwAIEwAIe5l6AfBM1zP71+8D3M7w38NSvwdwZQIg55437GbBN/+VCYCkpd+492ICgDABgDABgDB/A2DoR2L5Xf9nJgCGNvdATc0zAQfyzGcCLsXSn9n3aCYACDMBBEbe8kRgAviZCWAwRl3+hQAMGgEh4DcEAMIEAMIEAMIEAMIEAMIEAMIEAMIEAMIEAMIEAMIEAMIEAMIEAMIEAMIEAMIEAMIEAMIEAMIEAMIEAMIEAMIEAMIEAMIEAMIEAMIEAMIEAMIEAMIEAMIEAMIEAMIEAMIEAMIEAMIEAMIEAMIEAMLWUy+Ax7rsj+f6Hm9Oh93Ua5grE8Dg6hd//f0DAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACrX/kL09loCA79YyQAAAAASUVORK5CYII=",
  "ow-0007": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAQAAAAEACAYAAABccqhmAAABe0lEQVR4nO3YIQ7CQBAF0G0T0qPU9xp47oFGo3sPPNeo71EIhiCQDVXdwn/PrNhNdsyfTKYUAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAICf0dQugO09z9fb0t1hvJy2rYaa2qq/s6vwr7nnv5gAgnzC/Zjm49Kbbujv79MkkMEEAME0AAimAUAwDQCCWQKGWbPltwDMYQII8y3cwg8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEDZmRcrixgQ891zOQAAAABJRU5ErkJggg==",
  "ow-0008": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAQAAAAEACAYAAABccqhmAAAB+ElEQVR4nO3WMUoDQRiA0Y0QPIq917DPPVKnTp17pPca6T2KpJGUQbEQw+7O916zsMUwMzAf/zQBAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA8BibB63LP7ruj+e1X+j2dNjNvQe+e/rhHwsywuMf6RyjMQGs4NF8Xj7eppV7fn15v31NAstiAoAwAYAwAYAwAYAwAYAwAYAwAYAwAYAwAYAwAYAwAYAwAYAwAYAwAYAwAYAwAYAwAYAwAYAwAYAwAYAwAYAwAYAwAYAwAYAwAYAwAYAwAYAwAYAwAYAwAYAwAYAwAYAwAYAwAYAwAYAwAYAwAYAwAYAwAYAwAYAwAYAwAYAwAYAwAYAwAYAwAYAwAYAwAYAwAYAwAYAwAYAwAYAwAYAwAYAwAYAwAYAwAYCwzdwb4HfX/fE8yh1tT4fd3Hvgnglg4UZ5NKOcAwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAApj/4AiB9GHpBEti/AAAAAElFTkSuQmCC",
  "ow-0009": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAQAAAAEACAYAAABccqhmAAACiElEQVR4nO3WIU4DYRCA0S1Jw1HwXAPfe1RXV/ce9VyjnqOQGoJAoCg1O833nlmzYvIn82WWBQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGbarD0A97vuj+eJ77c9HXZrz8Btnm78j2GmLv/02fjNBfCAfhbs8/Lxtgz0/Pry/v11CcznAoAwAYAwAYAwAYAwAYAwAYAwAYAwAYAwAYAwAYAwAYAwAYAwAYAwAYAwAYAwAYAwAYAwAYAwAYAwAYAwAYAwAYAwAYAwAYAwAYAwAYAwAYAwAYAwAYAwAYAwAYAwAYAwAYAwAYAwAYAwAYAwAYAwAYAwAYAwAYAwAYAwAYAwAYAwAYAwAYAwAYAwAYAwAYAwAYAwAYAwAYAwAYAwAYAwAYAwAYAwAYAwAYAwAYAwAYAwAYAwAYAwAYAwAYAwAYAwAYAwAYAwAYAwAYAwAYAwAYAwAYAwAYAwAYAwAYAwAYAwAYAwAYAwAYAwAYAwAYAwAYAwAYAwAYAwAYAwAYAwAYAwAYAwAYAwAYAwAYAwAYAwAYAwAYAwAYAwAYAwAYAwAYAwAYAwAYAwAYAwAYAwAYAwAYAwAYAwAYAwAYAwAYAwAYAwAYAwAYAwAYAwAYAwAYAwAYAwAYAwAYAwAYAwAYAwAYAwAYAwAYAwAYAwAYAwAYAwAYAwAYAwAYAwAYAwAYAwAYCwzdoDcJ/r/nie/Hbb02G39gz8zQXwoCYv2OTZAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACA5X++AFEgGQw1KYnpAAAAAElFTkSuQmCC",
  "ow-0010": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAQAAAAEACAYAAABccqhmAAADNklEQVR4nO3bMUoDQRiA0Y0oHsXea9h7D+vU1rmHvdew9yhiIylSKSiBnTXzvdekCcxAdj5+dsiyAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAN/tlkl8Pj2/rL3GzWH/uPYaMNLVMoERh3/kOjDKxU8Ap0P58fb+sPZat/d3r8dPkwCzmGICAM4jABAmABAmABB2vfUGZufmgC389UW1CWBFDj///dkzAUxwPQk/XVkfn8HfJgETAIQJAIQJAIQJAIQJAIQJAIRd/DXg8ZrjeN1x+qfeiPVGrAMjTDEBjDqUDj+zufgJ4MThhOgEAJxHACBMACBMACBMACBMACBMACBMACBMACBMACBMACBMACBMACBMACBMACBMACBMACBMACBMACBMACBMACBMACBMACBMACBMACBMACBMACBMACBMACBMACBMACBMACBMACBMACBMACBMACBMACBMACBMACBMACBMACBMACBMACBMACBMACBMACBMACBMACBMACBMACBMACBMACBMACBMACBMACBMACBMACBMACBMACBMACBMACBMACBMACBMACBMACBMACBMACBMACBMACBMACBMACBMACBMACBMACBMACBMACBMACBMACBMACBMACBMACBMACBMACBMACBMACBMACBMACBMACBMACBMACBMACBMACBMACBMACBMACBMACBMACBMACBMACBMACBMACBMACBMACBMACBMACBMACBMACBMACBMACBMACBMACBMACBMACBMACBMACBMACBMACBMACBMACBMACBMACBMACBMACBMACBMACBMACBMACBMACBMACBMACBMACBMACBMACBMACBMACBMACBMACBMACBMACBMACBMACBMACBMACBMACBMACBMACBMACBMACBMACBMACBMACBMACBMACBMACBMACBMACBMACBMACBMACBMACBMACBMACBMACBMACBMACBMACBMACBMACBMACBMACBMACBMACBMACBst/UGZvb59Pyy9R7oujnsH3/7jglg4x8A1uDZAwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgGWIL1uQOARnJ220AAAAAElFTkSuQmCC",
  "ow-0011": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAQAAAAEACAYAAABccqhmAAAClUlEQVR4nO3cMUprQRiA0UQILsXebdhnH6lTp84+0rsNe5ciacRCEB5igk9nrt85TQi5cIfAfPwk3FmtAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA4E9aj14A33PeHU6zfIeb4347eg1c5+bK65nITJt/xvXwNRPAQr1vtpen54fVJG7v7x7fXk0Cy2ECgDABgDABgDABgDABgDABgDABgDABgDABgDABgDABgDABgDABgDABgDABgDABgDABgDABgDABgDBnAi7YjIdwOg9wWUwACzbbZpttPQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADAB+uPb5jHeXc4ffbZ5rjf/u5q+KtuRi+A6zb/JZ/DpUwAk3nf3C9Pzw+fXXN7f/f49moS4LtMABAmABAmABAmABAmABAmABAmABAmABAmABAmABAmABAmABDmYaAJXfK0nweB+B9MABP6anPb/AAAAABcw78Acb99vqAfMOfiX4CwEYeLOtB0LiaAqEsOH/0JDjSdiwkAwgQAwgQAwgQAwgQAwgQAwgQAwgQAwgQAwgQAwgQAwgQAwgQAwgQAwgQAwgQAwgQAwgQAwgQAwgQAwgQAwgQAwgQAwgQAwgQAwgQAwgQAwgQAwgQAwgQAwgQAwgQAwgQAwgQAwgQAwgQAwgQAwgQAwgQAwgQAwgQAwgQAwgQAwtajF8A4593hNOK+m+N+O+K+/MsEEDZiI9r8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAwOrnvQI54UiqchZmYgAAAABJRU5ErkJggg==",
  "ow-0012": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAQAAAAEACAYAAABccqhmAAACaUlEQVR4nO3dvY3CMACGYYNAjELPGunZg5qamj3oWYOeUaI0pxSnqyAFFyfhe56WKI6Q/Mqy+SkFAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjZaqwbd6fL7dVr2+v5ONa4wMQBeDf5h4gDLDgAv5O/fTybV9fsDvv7u3uIANSxKRN5FYg+Dn1ERADGt64wBjBTAgDBBACCCQAEEwAIJgAQ7N+PAfvju/4Yb+isH/jSFYAzfAj/LsAnHxUWEPjiPYB3E9zkBwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAIAhq8ErIEh3utzKDGyv52ONcdY1BoEl6GYy+Ws+ixUAlL8J1z6ezRzekN1hf6+xErACgGACAMEEAIIJAAQTAAgmABBMACCYAEAwAYBgAgDBBACCCQAEEwAIJgAQTAAgmABAMAGAYAIAwQQAggkABBMACCYAEEwAIJgAQDABgGACAMEEAIIJAAQTAAgmABBMACDYauoHgLnoTpdbmZHt9XwcewwrAKg44Zb4LAAAwNewCQjBG5c2ASH41MIKABY8+dvHs/nkPlYAEEwAIJgAQDABgGACAMEEAIIJAAQTAAgmABBMACCYAEAwAYBgAgDBBACCCQAEEwAI5gdBIPgXgawAYKH8dwBQPvEDketMid4pjOcAAAAASUVORK5CYII=",
  "ow-0013": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAQAAAAEACAYAAABccqhmAAABnUlEQVR4nO3coQ0CQRCG0YWEUAqeNvD0gUaj6QNPG3hKIRiCoIFjyS3zv2dO7WXNfBm1rQEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADUtZj7Avze83C6TD27Oh/3fW/DSJZzX4Bxh7/HecZmAyjsM7yP23039R/r7eb6/toEarIBQDABgGACAMEEAIIJAAQTAAgmABBMACCYAEAwAYBgAgDBBACCCQAEEwAIJgAQTAAgmABAMAGAYAIAwbwJWFyPRz29B1iXDaC4b4fX8AMAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADQ/tQLj0AYLiet4gIAAAAASUVORK5CYII=",
  "ow-0014": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAQAAAAEACAYAAABccqhmAAAClUlEQVR4nO3dMW7CQBAFUEBCHIWea9BzD2pqau5BzzXoOQqiiVwgIYSJbSWG3f9eg2I5ipv5GsgwO5kAAABBpp9+AMp22+6PXe6bH3ab/38a+pr1/g3oWfx972U8OgAGuRf09XxZd7l/sVqemledwHfRAUAwAQDBBAAEEwAQTABAMAEAwQQABBMAEEwAQDABAMEEAAQTABBMAEAwAQDBBAAEEwAQTABAMBuBGKzvmi/bgL6PDoDB+hS04gcAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABGNB3zj0GJbtv98fHn+WG3mVRi9ukHgJKKv+1aqXQA0OJe6NfzZf14fbFanmrpBHQAEEwAQDABAMEEAATzISC80faJfw0fADZ0APDGq0KvpfgBAAAAAAAAAAAAAAAAAAAAAAAAyFuyWdPRWqWzFJTRPBa+EPgOAoDRz9m7n7UnBD5PAEAwAQDBBAAEczQYo3l+z++EHQjj34AAAAAAAAAAAAB/zCgwg8d5jfKWz5eBGDzL7/v85dMB0Huhx/3aYrU8Na86gXLpACCYAIBgAgCCCQAIJgAgmACAYAIAgpkDoLNXgz9mAMqmA6Cz52JX/AAAAAAAAN/KHEAlHLzJEOYAKh3Qsa2HLnQAFW7qadjWQxc6AAgmACCYAIBgAgCCCQAIJgAgmACAYAIAghkEqkDb1J+NPfxGB1CBV4Wu+AEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGDS6geBIH8eZuuysAAAAABJRU5ErkJggg==",
  "ow-0015": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAQAAAAEACAYAAABccqhmAAADQUlEQVR4nO3cIW4CURRAUWhKupT6bgPPPtBoNPvAsw08SyGYhjSVtf9PuecY5J8MzM0bxFutAAAAAICXth552GN/PI88b8k2p8Nu9jXA26hb4OF3P4hOAL8P//1624447z/4+Pq8PD9NAiQmAGB5BADCBADCBADCBADCBADCBADCBADCBADCBADCBADCBADCBADCBADCBADCBADCBADCBADC3mdfQJ1diT+sRpvDBMAiCOEcloKyCJakzmECgDABgDABgDABgDABgDABgDABgDABgDABgDABgDABgDABgDABgDABgDABgDABgDABgDABgDABgLAhOwH/Wvp4v962o85n2ewEfPEJwNpniL8CPCMgBLAc/gOAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAsPWsgx/743nW2SzT5nTYzb6GmmkTgC8bvwcAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABgNdA3YY00bnlBE6oAAAAASUVORK5CYII="
};

export const DARTIS_BENCHMARKS: Record<string, DartisBenchmarkInfo> = {
  "ow-0001": {
    "datasetKey": "ow-0001",
    "title": "Copernicus Sentinel-1 SAR ow-0001.jpg (Benchmark)",
    "sceneId": "ow-0001.jpg",
    "imagePath": "/sar_images/ow-0001.jpg",
    "maskPath": "/true_masks/ow-0001.png",
    "areaSqKm": 0.3797,
    "perimeterKm": 2.2647,
    "eccentricity": 0.88,
    "dampingRatioDb": 9.67,
    "segmentationDiceScore": 0.713,
    "segmentationIouScore": 0.554,
    "maxProbability": 0.982257,
    "oilLikelihoodScore": 0.945,
    "lookalikeScore": 0.055,
    "confidenceScore": 0.945,
    "center": [
      33.057756,
      33.259026
    ],
    "location": "Cyprus Offshore \u2022 Eastern Mediterranean",
    "acquisitionStartUtc": "2019-01-01 03:42:35 UTC",
    "acquisitionStartIst": "2019-01-01 09:12:35 IST",
    "sentinelProduct": "S1B_IW_GRDH_1SDV_20190101T034300_20190101T034325_014295_01A97E_39B8.SAFE",
    "estimatedDischargeLiters": 4078,
    "classProbabilities": {
      "Oil": 94.5,
      "Calm water": 1.8,
      "Natural film": 1.5,
      "Wake": 1.4,
      "Rain-related artifact": 0.5,
      "Unknown": 0.3
    },
    "polygonCoordinates": [
      [
        33.055625,
        33.261205
      ],
      [
        33.055705,
        33.260903
      ],
      [
        33.055786,
        33.260601
      ],
      [
        33.055867,
        33.260299
      ],
      [
        33.055948,
        33.259997
      ],
      [
        33.056029,
        33.259696
      ],
      [
        33.05611,
        33.259394
      ],
      [
        33.056191,
        33.259092
      ],
      [
        33.056272,
        33.25879
      ],
      [
        33.056353,
        33.258488
      ],
      [
        33.056433,
        33.258186
      ],
      [
        33.056514,
        33.257884
      ],
      [
        33.056595,
        33.257583
      ],
      [
        33.056676,
        33.257281
      ],
      [
        33.056757,
        33.256979
      ],
      [
        33.056838,
        33.256677
      ],
      [
        33.056919,
        33.256375
      ],
      [
        33.057,
        33.256073
      ],
      [
        33.057361,
        33.25617
      ],
      [
        33.057722,
        33.256267
      ],
      [
        33.058083,
        33.256364
      ],
      [
        33.058443,
        33.25646
      ],
      [
        33.058804,
        33.256557
      ],
      [
        33.059165,
        33.256654
      ],
      [
        33.059526,
        33.25675
      ],
      [
        33.059887,
        33.256847
      ],
      [
        33.059807,
        33.257149
      ],
      [
        33.059726,
        33.257451
      ],
      [
        33.059645,
        33.257753
      ],
      [
        33.059564,
        33.258055
      ],
      [
        33.059483,
        33.258356
      ],
      [
        33.059402,
        33.258658
      ],
      [
        33.059321,
        33.25896
      ],
      [
        33.05924,
        33.259262
      ],
      [
        33.059159,
        33.259564
      ],
      [
        33.059079,
        33.259866
      ],
      [
        33.058998,
        33.260168
      ],
      [
        33.058917,
        33.260469
      ],
      [
        33.058836,
        33.260771
      ],
      [
        33.058755,
        33.261073
      ],
      [
        33.058674,
        33.261375
      ],
      [
        33.058593,
        33.261677
      ],
      [
        33.058512,
        33.261979
      ],
      [
        33.058151,
        33.261882
      ],
      [
        33.05779,
        33.261785
      ],
      [
        33.057429,
        33.261688
      ],
      [
        33.057069,
        33.261592
      ],
      [
        33.056708,
        33.261495
      ],
      [
        33.056347,
        33.261398
      ],
      [
        33.055986,
        33.261302
      ],
      [
        33.055625,
        33.261205
      ]
    ]
  },
  "ow-0002": {
    "datasetKey": "ow-0002",
    "title": "Copernicus Sentinel-1 SAR ow-0002.jpg",
    "sceneId": "ow-0002.jpg",
    "imagePath": "/sar_images/ow-0002.jpg",
    "maskPath": "/true_masks/ow-0002.png",
    "areaSqKm": 0.675,
    "perimeterKm": 3.2921,
    "eccentricity": 0.867,
    "dampingRatioDb": 9.36,
    "segmentationDiceScore": 0.732,
    "segmentationIouScore": 0.5772,
    "maxProbability": 0.96841,
    "oilLikelihoodScore": 0.941,
    "lookalikeScore": 0.059,
    "confidenceScore": 0.941,
    "center": [
      32.027728,
      31.68675
    ],
    "location": "Port Said Anchorage Approach \u2022 Levantine Sector",
    "acquisitionStartUtc": "2019-01-04 15:56:38 UTC",
    "acquisitionStartIst": "2019-01-04 21:26:38 IST",
    "sentinelProduct": "S1A_IW_GRDH_1SDV_20190104T155703_20190104T155728_025329_02CD61_8708.SAFE",
    "estimatedDischargeLiters": 7250,
    "classProbabilities": {
      "Oil": 94.1,
      "Calm water": 2.0,
      "Natural film": 1.7,
      "Wake": 1.4,
      "Rain-related artifact": 0.5,
      "Unknown": 0.3
    },
    "polygonCoordinates": [
      [
        32.023759,
        31.687863
      ],
      [
        32.024201,
        31.687421
      ],
      [
        32.024642,
        31.686979
      ],
      [
        32.025084,
        31.686537
      ],
      [
        32.025526,
        31.686095
      ],
      [
        32.025968,
        31.685653
      ],
      [
        32.02641,
        31.685211
      ],
      [
        32.026852,
        31.684769
      ],
      [
        32.027294,
        31.684327
      ],
      [
        32.027736,
        31.683885
      ],
      [
        32.028178,
        31.683444
      ],
      [
        32.02862,
        31.683002
      ],
      [
        32.029101,
        31.68304
      ],
      [
        32.02962,
        31.68356
      ],
      [
        32.030139,
        31.684079
      ],
      [
        32.030659,
        31.684598
      ],
      [
        32.031178,
        31.685118
      ],
      [
        32.031697,
        31.685637
      ],
      [
        32.031255,
        31.686079
      ],
      [
        32.030814,
        31.686521
      ],
      [
        32.030372,
        31.686963
      ],
      [
        32.02993,
        31.687405
      ],
      [
        32.029488,
        31.687847
      ],
      [
        32.029046,
        31.688289
      ],
      [
        32.028604,
        31.688731
      ],
      [
        32.028162,
        31.689173
      ],
      [
        32.02772,
        31.689615
      ],
      [
        32.027278,
        31.690056
      ],
      [
        32.026836,
        31.690498
      ],
      [
        32.026355,
        31.69046
      ],
      [
        32.025836,
        31.68994
      ],
      [
        32.025317,
        31.689421
      ],
      [
        32.024797,
        31.688902
      ],
      [
        32.024278,
        31.688382
      ],
      [
        32.023759,
        31.687863
      ]
    ]
  },
  "ow-0003": {
    "datasetKey": "ow-0003",
    "title": "Copernicus Sentinel-1 SAR ow-0003.jpg",
    "sceneId": "ow-0003.jpg",
    "imagePath": "/sar_images/ow-0003.jpg",
    "maskPath": "/true_masks/ow-0003.png",
    "areaSqKm": 0.3563,
    "perimeterKm": 2.4207,
    "eccentricity": 0.908,
    "dampingRatioDb": 9.36,
    "segmentationDiceScore": 0.7085,
    "segmentationIouScore": 0.5486,
    "maxProbability": 0.97412,
    "oilLikelihoodScore": 0.941,
    "lookalikeScore": 0.059,
    "confidenceScore": 0.941,
    "center": [
      30.627168,
      31.573115
    ],
    "location": "Nile Delta Offshore Shelf \u2022 Alexandria Corridor",
    "acquisitionStartUtc": "2019-01-10 15:56:11 UTC",
    "acquisitionStartIst": "2019-01-10 21:26:11 IST",
    "sentinelProduct": "S1B_IW_GRDH_1SDV_20190110T155611_20190110T155636_014434_01AE1A_6C82.SAFE",
    "estimatedDischargeLiters": 3820,
    "classProbabilities": {
      "Oil": 94.1,
      "Calm water": 2.0,
      "Natural film": 1.7,
      "Wake": 1.4,
      "Rain-related artifact": 0.5,
      "Unknown": 0.3
    },
    "polygonCoordinates": [
      [
        30.626366,
        31.569731
      ],
      [
        30.626677,
        31.569758
      ],
      [
        30.626989,
        31.569786
      ],
      [
        30.6273,
        31.569813
      ],
      [
        30.627611,
        31.56984
      ],
      [
        30.627923,
        31.569867
      ],
      [
        30.628234,
        31.569894
      ],
      [
        30.628545,
        31.569922
      ],
      [
        30.628513,
        31.570287
      ],
      [
        30.628481,
        31.570653
      ],
      [
        30.628449,
        31.571018
      ],
      [
        30.628417,
        31.571383
      ],
      [
        30.628385,
        31.571749
      ],
      [
        30.628353,
        31.572114
      ],
      [
        30.628322,
        31.57248
      ],
      [
        30.62829,
        31.572845
      ],
      [
        30.628258,
        31.57321
      ],
      [
        30.628226,
        31.573576
      ],
      [
        30.628194,
        31.573941
      ],
      [
        30.628162,
        31.574307
      ],
      [
        30.62813,
        31.574672
      ],
      [
        30.628098,
        31.575037
      ],
      [
        30.628066,
        31.575403
      ],
      [
        30.628034,
        31.575768
      ],
      [
        30.628002,
        31.576134
      ],
      [
        30.62797,
        31.576499
      ],
      [
        30.627659,
        31.576472
      ],
      [
        30.627347,
        31.576444
      ],
      [
        30.627036,
        31.576417
      ],
      [
        30.626725,
        31.57639
      ],
      [
        30.626413,
        31.576363
      ],
      [
        30.626102,
        31.576336
      ],
      [
        30.625791,
        31.576308
      ],
      [
        30.625823,
        31.575943
      ],
      [
        30.625855,
        31.575577
      ],
      [
        30.625887,
        31.575212
      ],
      [
        30.625919,
        31.574847
      ],
      [
        30.625951,
        31.574481
      ],
      [
        30.625983,
        31.574116
      ],
      [
        30.626014,
        31.57375
      ],
      [
        30.626046,
        31.573385
      ],
      [
        30.626078,
        31.57302
      ],
      [
        30.62611,
        31.572654
      ],
      [
        30.626142,
        31.572289
      ],
      [
        30.626174,
        31.571923
      ],
      [
        30.626206,
        31.571558
      ],
      [
        30.626238,
        31.571193
      ],
      [
        30.62627,
        31.570827
      ],
      [
        30.626302,
        31.570462
      ],
      [
        30.626334,
        31.570096
      ],
      [
        30.626366,
        31.569731
      ]
    ]
  },
  "ow-0004": {
    "datasetKey": "ow-0004",
    "title": "Copernicus Sentinel-1 SAR ow-0004.jpg",
    "sceneId": "ow-0004.jpg",
    "imagePath": "/sar_images/ow-0004.jpg",
    "maskPath": "/true_masks/ow-0004.png",
    "areaSqKm": 0.8883,
    "perimeterKm": 4.5508,
    "eccentricity": 0.986,
    "dampingRatioDb": 9.36,
    "segmentationDiceScore": 0.724,
    "segmentationIouScore": 0.5674,
    "maxProbability": 0.96538,
    "oilLikelihoodScore": 0.941,
    "lookalikeScore": 0.059,
    "confidenceScore": 0.941,
    "center": [
      31.182691,
      31.712541
    ],
    "location": "Damietta Fairway Offshore Basin",
    "acquisitionStartUtc": "2019-01-10 15:56:11 UTC",
    "acquisitionStartIst": "2019-01-10 21:26:11 IST",
    "sentinelProduct": "S1B_IW_GRDH_1SDV_20190110T155611_20190110T155636_014434_01AE1A_6C82.SAFE",
    "estimatedDischargeLiters": 9540,
    "classProbabilities": {
      "Oil": 94.1,
      "Calm water": 2.0,
      "Natural film": 1.7,
      "Wake": 1.4,
      "Rain-related artifact": 0.5,
      "Unknown": 0.3
    },
    "polygonCoordinates": [
      [
        31.17925,
        31.715851
      ],
      [
        31.180131,
        31.716171
      ],
      [
        31.181012,
        31.716492
      ],
      [
        31.181893,
        31.716813
      ],
      [
        31.182774,
        31.717133
      ],
      [
        31.183655,
        31.717454
      ],
      [
        31.184536,
        31.717774
      ],
      [
        31.185416,
        31.718095
      ],
      [
        31.186297,
        31.718416
      ],
      [
        31.187178,
        31.718736
      ],
      [
        31.188059,
        31.719057
      ],
      [
        31.18894,
        31.719378
      ],
      [
        31.189821,
        31.719698
      ],
      [
        31.190702,
        31.720019
      ],
      [
        31.190745,
        31.720816
      ],
      [
        31.190368,
        31.721852
      ],
      [
        31.189823,
        31.722435
      ],
      [
        31.188942,
        31.722115
      ],
      [
        31.188061,
        31.721794
      ],
      [
        31.18718,
        31.721473
      ],
      [
        31.186299,
        31.721153
      ],
      [
        31.185418,
        31.720832
      ],
      [
        31.184537,
        31.720511
      ],
      [
        31.183656,
        31.720191
      ],
      [
        31.182775,
        31.71987
      ],
      [
        31.181894,
        31.71955
      ],
      [
        31.181013,
        31.719229
      ],
      [
        31.180132,
        31.718908
      ],
      [
        31.179251,
        31.718588
      ],
      [
        31.17837,
        31.718267
      ],
      [
        31.178747,
        31.717231
      ],
      [
        31.179124,
        31.716196
      ],
      [
        31.17925,
        31.715851
      ]
    ]
  },
  "ow-0005": {
    "datasetKey": "ow-0005",
    "title": "Copernicus Sentinel-1 SAR ow-0005.jpg",
    "sceneId": "ow-0005.jpg",
    "imagePath": "/sar_images/ow-0005.jpg",
    "maskPath": "/true_masks/ow-0005.png",
    "areaSqKm": 0.9844,
    "perimeterKm": 2.7111,
    "eccentricity": 0.981,
    "dampingRatioDb": 9.36,
    "segmentationDiceScore": 0.7195,
    "segmentationIouScore": 0.5619,
    "maxProbability": 0.97892,
    "oilLikelihoodScore": 0.941,
    "lookalikeScore": 0.059,
    "confidenceScore": 0.941,
    "center": [
      32.146674,
      31.923902
    ],
    "location": "Suez Canal North Approach Transit Corridor",
    "acquisitionStartUtc": "2019-01-10 15:56:11 UTC",
    "acquisitionStartIst": "2019-01-10 21:26:11 IST",
    "sentinelProduct": "S1B_IW_GRDH_1SDV_20190110T155611_20190110T155636_014434_01AE1A_6C82.SAFE",
    "estimatedDischargeLiters": 10580,
    "classProbabilities": {
      "Oil": 94.1,
      "Calm water": 2.0,
      "Natural film": 1.7,
      "Wake": 1.4,
      "Rain-related artifact": 0.5,
      "Unknown": 0.3
    },
    "polygonCoordinates": [
      [
        30.840596,
        31.61648
      ],
      [
        30.841211,
        31.616371
      ],
      [
        30.841827,
        31.616263
      ],
      [
        30.842442,
        31.616154
      ],
      [
        30.843058,
        31.616046
      ],
      [
        30.843673,
        31.615937
      ],
      [
        30.844289,
        31.615829
      ],
      [
        30.84466,
        31.616136
      ],
      [
        30.844788,
        31.616859
      ],
      [
        30.844915,
        31.617582
      ],
      [
        30.845043,
        31.618304
      ],
      [
        30.84517,
        31.619027
      ],
      [
        30.845298,
        31.61975
      ],
      [
        30.845425,
        31.620473
      ],
      [
        30.845553,
        31.621196
      ],
      [
        30.844937,
        31.621304
      ],
      [
        30.844322,
        31.621413
      ],
      [
        30.843706,
        31.621521
      ],
      [
        30.843091,
        31.62163
      ],
      [
        30.842475,
        31.621738
      ],
      [
        30.84186,
        31.621847
      ],
      [
        30.841488,
        31.62154
      ],
      [
        30.841361,
        31.620817
      ],
      [
        30.841233,
        31.620094
      ],
      [
        30.841106,
        31.619371
      ],
      [
        30.840978,
        31.618648
      ],
      [
        30.840851,
        31.617926
      ],
      [
        30.840723,
        31.617203
      ],
      [
        30.840596,
        31.61648
      ]
    ]
  },
  "ow-0006": {
    "datasetKey": "ow-0006",
    "title": "Copernicus Sentinel-1 SAR ow-0006.jpg",
    "sceneId": "ow-0006.jpg",
    "imagePath": "/sar_images/ow-0006.jpg",
    "maskPath": "/true_masks/ow-0006.png",
    "areaSqKm": 25.0414,
    "perimeterKm": 16.7509,
    "eccentricity": 0.926,
    "dampingRatioDb": 9.36,
    "segmentationDiceScore": 0.741,
    "segmentationIouScore": 0.5886,
    "maxProbability": 0.98115,
    "oilLikelihoodScore": 0.941,
    "lookalikeScore": 0.059,
    "confidenceScore": 0.941,
    "center": [
      32.471212,
      32.374794
    ],
    "location": "Central Levantine Major Spill Zone",
    "acquisitionStartUtc": "2019-01-11 15:48:36 UTC",
    "acquisitionStartIst": "2019-01-11 21:18:36 IST",
    "sentinelProduct": "S1A_IW_GRDH_1SDV_20190111T154901_20190111T154926_025431_02D0FB_FB38.SAFE",
    "estimatedDischargeLiters": 268000,
    "classProbabilities": {
      "Oil": 94.1,
      "Calm water": 2.0,
      "Natural film": 1.7,
      "Wake": 1.4,
      "Rain-related artifact": 0.5,
      "Unknown": 0.3
    },
    "polygonCoordinates": [
      [
        32.408862,
        31.812459
      ],
      [
        32.411514,
        31.81511
      ],
      [
        32.414166,
        31.817762
      ],
      [
        32.416817,
        31.820414
      ],
      [
        32.419469,
        31.823065
      ],
      [
        32.42212,
        31.825717
      ],
      [
        32.424772,
        31.828369
      ],
      [
        32.427424,
        31.83102
      ],
      [
        32.430075,
        31.833672
      ],
      [
        32.431284,
        31.836441
      ],
      [
        32.428162,
        31.839563
      ],
      [
        32.425041,
        31.842684
      ],
      [
        32.421919,
        31.845806
      ],
      [
        32.418798,
        31.848927
      ],
      [
        32.415676,
        31.852049
      ],
      [
        32.412829,
        31.851802
      ],
      [
        32.410177,
        31.849151
      ],
      [
        32.407526,
        31.846499
      ],
      [
        32.404874,
        31.843848
      ],
      [
        32.402222,
        31.841196
      ],
      [
        32.399571,
        31.838544
      ],
      [
        32.396919,
        31.835893
      ],
      [
        32.394267,
        31.833241
      ],
      [
        32.391616,
        31.830589
      ],
      [
        32.393775,
        31.827546
      ],
      [
        32.396896,
        31.824425
      ],
      [
        32.400018,
        31.821303
      ],
      [
        32.403139,
        31.818182
      ],
      [
        32.406261,
        31.81506
      ],
      [
        32.408862,
        31.812459
      ]
    ]
  },
  "ow-0007": {
    "datasetKey": "ow-0007",
    "title": "Copernicus Sentinel-1 SAR ow-0007.jpg",
    "sceneId": "ow-0007.jpg",
    "imagePath": "/sar_images/ow-0007.jpg",
    "maskPath": "/true_masks/ow-0007.png",
    "areaSqKm": 0.082,
    "perimeterKm": 0.9683,
    "eccentricity": 0.707,
    "dampingRatioDb": 9.36,
    "segmentationDiceScore": 0.695,
    "segmentationIouScore": 0.5326,
    "maxProbability": 0.9624,
    "oilLikelihoodScore": 0.941,
    "lookalikeScore": 0.059,
    "confidenceScore": 0.941,
    "center": [
      31.1814,
      31.66357
    ],
    "location": "Damietta Coastal Shelf Sector",
    "acquisitionStartUtc": "2019-01-12 03:51:17 UTC",
    "acquisitionStartIst": "2019-01-12 09:21:17 IST",
    "sentinelProduct": "S1A_IW_GRDH_1SDV_20190112T035232_20190112T035257_025438_02D136_B006.SAFE",
    "estimatedDischargeLiters": 880,
    "classProbabilities": {
      "Oil": 94.1,
      "Calm water": 2.0,
      "Natural film": 1.7,
      "Wake": 1.4,
      "Rain-related artifact": 0.5,
      "Unknown": 0.3
    },
    "polygonCoordinates": [
      [
        31.952943,
        31.73213
      ],
      [
        31.953099,
        31.731859
      ],
      [
        31.953255,
        31.731589
      ],
      [
        31.953412,
        31.731318
      ],
      [
        31.953568,
        31.731048
      ],
      [
        31.953886,
        31.731231
      ],
      [
        31.954204,
        31.731415
      ],
      [
        31.954522,
        31.731599
      ],
      [
        31.954841,
        31.731782
      ],
      [
        31.955159,
        31.731966
      ],
      [
        31.955477,
        31.73215
      ],
      [
        31.955321,
        31.732421
      ],
      [
        31.955165,
        31.732691
      ],
      [
        31.955008,
        31.732962
      ],
      [
        31.954852,
        31.733232
      ],
      [
        31.954534,
        31.733049
      ],
      [
        31.954216,
        31.732865
      ],
      [
        31.953898,
        31.732681
      ],
      [
        31.953579,
        31.732498
      ],
      [
        31.953261,
        31.732314
      ],
      [
        31.952943,
        31.73213
      ]
    ]
  },
  "ow-0008": {
    "datasetKey": "ow-0008",
    "title": "Copernicus Sentinel-1 SAR ow-0008.jpg",
    "sceneId": "ow-0008.jpg",
    "imagePath": "/sar_images/ow-0008.jpg",
    "maskPath": "/true_masks/ow-0008.png",
    "areaSqKm": 6.6612,
    "perimeterKm": 10.1667,
    "eccentricity": 0.535,
    "dampingRatioDb": 9.36,
    "segmentationDiceScore": 0.728,
    "segmentationIouScore": 0.5723,
    "maxProbability": 0.9715,
    "oilLikelihoodScore": 0.941,
    "lookalikeScore": 0.059,
    "confidenceScore": 0.941,
    "center": [
      35.264055,
      34.074996
    ],
    "location": "Beirut / Lebanese Offshore Shipping Channel",
    "acquisitionStartUtc": "2019-01-12 15:39:43 UTC",
    "acquisitionStartIst": "2019-01-12 21:09:43 IST",
    "sentinelProduct": "S1B_IW_GRDH_1SDV_20190112T154033_20190112T154058_014463_01AF27_E8BC.SAFE",
    "estimatedDischargeLiters": 71500,
    "classProbabilities": {
      "Oil": 94.1,
      "Calm water": 2.0,
      "Natural film": 1.7,
      "Wake": 1.4,
      "Rain-related artifact": 0.5,
      "Unknown": 0.3
    },
    "polygonCoordinates": [
      [
        32.119775,
        31.885149
      ],
      [
        32.120523,
        31.887205
      ],
      [
        32.121271,
        31.889261
      ],
      [
        32.12202,
        31.891316
      ],
      [
        32.122768,
        31.893372
      ],
      [
        32.123516,
        31.895427
      ],
      [
        32.124264,
        31.897483
      ],
      [
        32.125012,
        31.899539
      ],
      [
        32.12576,
        31.901594
      ],
      [
        32.123792,
        31.902643
      ],
      [
        32.121371,
        31.903524
      ],
      [
        32.11895,
        31.904406
      ],
      [
        32.116528,
        31.905287
      ],
      [
        32.114107,
        31.906168
      ],
      [
        32.111686,
        31.907049
      ],
      [
        32.109265,
        31.907931
      ],
      [
        32.108517,
        31.905875
      ],
      [
        32.107769,
        31.903819
      ],
      [
        32.10702,
        31.901764
      ],
      [
        32.106272,
        31.899708
      ],
      [
        32.105524,
        31.897653
      ],
      [
        32.104776,
        31.895597
      ],
      [
        32.104028,
        31.893541
      ],
      [
        32.10328,
        31.891486
      ],
      [
        32.105248,
        31.890437
      ],
      [
        32.107669,
        31.889556
      ],
      [
        32.11009,
        31.888674
      ],
      [
        32.112512,
        31.887793
      ],
      [
        32.114933,
        31.886912
      ],
      [
        32.117354,
        31.886031
      ],
      [
        32.119775,
        31.885149
      ]
    ]
  },
  "ow-0009": {
    "datasetKey": "ow-0009",
    "title": "Copernicus Sentinel-1 SAR ow-0009.jpg",
    "sceneId": "ow-0009.jpg",
    "imagePath": "/sar_images/ow-0009.jpg",
    "maskPath": "/true_masks/ow-0009.png",
    "areaSqKm": 11.6676,
    "perimeterKm": 16.17,
    "eccentricity": 0.957,
    "dampingRatioDb": 9.36,
    "segmentationDiceScore": 0.735,
    "segmentationIouScore": 0.581,
    "maxProbability": 0.9768,
    "oilLikelihoodScore": 0.941,
    "lookalikeScore": 0.059,
    "confidenceScore": 0.941,
    "center": [
      34.889358,
      34.606175
    ],
    "location": "Syrian Basin Shipping Route",
    "acquisitionStartUtc": "2019-01-19 03:42:58 UTC",
    "acquisitionStartIst": "2019-01-19 09:12:58 IST",
    "sentinelProduct": "S1A_IW_GRDH_1SDV_20190119T034323_20190119T034348_025540_02D4E3_A870.SAFE",
    "estimatedDischargeLiters": 125000,
    "classProbabilities": {
      "Oil": 94.1,
      "Calm water": 2.0,
      "Natural film": 1.7,
      "Wake": 1.4,
      "Rain-related artifact": 0.5,
      "Unknown": 0.3
    },
    "polygonCoordinates": [
      [
        30.964032,
        31.652907
      ],
      [
        30.967352,
        31.652017
      ],
      [
        30.970673,
        31.651128
      ],
      [
        30.973993,
        31.650238
      ],
      [
        30.977313,
        31.649348
      ],
      [
        30.980634,
        31.648459
      ],
      [
        30.983954,
        31.647569
      ],
      [
        30.987274,
        31.646679
      ],
      [
        30.990595,
        31.64579
      ],
      [
        30.993915,
        31.6449
      ],
      [
        30.997236,
        31.64401
      ],
      [
        31.000556,
        31.64312
      ],
      [
        31.003463,
        31.643102
      ],
      [
        31.004508,
        31.647002
      ],
      [
        31.005553,
        31.650903
      ],
      [
        31.006598,
        31.654804
      ],
      [
        31.004072,
        31.656241
      ],
      [
        31.000751,
        31.657131
      ],
      [
        30.997431,
        31.65802
      ],
      [
        30.99411,
        31.65891
      ],
      [
        30.99079,
        31.6598
      ],
      [
        30.98747,
        31.660689
      ],
      [
        30.984149,
        31.661579
      ],
      [
        30.980829,
        31.662469
      ],
      [
        30.977509,
        31.663358
      ],
      [
        30.974188,
        31.664248
      ],
      [
        30.970868,
        31.665138
      ],
      [
        30.967547,
        31.666027
      ],
      [
        30.966502,
        31.662127
      ],
      [
        30.965457,
        31.658226
      ],
      [
        30.964412,
        31.654325
      ],
      [
        30.964032,
        31.652907
      ]
    ]
  },
  "ow-0010": {
    "datasetKey": "ow-0010",
    "title": "Copernicus Sentinel-1 SAR ow-0010.jpg",
    "sceneId": "ow-0010.jpg",
    "imagePath": "/sar_images/ow-0010.jpg",
    "maskPath": "/true_masks/ow-0010.png",
    "areaSqKm": 68.5898,
    "perimeterKm": 32.8241,
    "eccentricity": 0.496,
    "dampingRatioDb": 9.36,
    "segmentationDiceScore": 0.752,
    "segmentationIouScore": 0.6026,
    "maxProbability": 0.9842,
    "oilLikelihoodScore": 0.941,
    "lookalikeScore": 0.059,
    "confidenceScore": 0.941,
    "center": [
      33.348573,
      34.114555
    ],
    "location": "Larnaca Deep Water Maritime Corridor",
    "acquisitionStartUtc": "2019-01-19 03:42:58 UTC",
    "acquisitionStartIst": "2019-01-19 09:12:58 IST",
    "sentinelProduct": "S1A_IW_GRDH_1SDV_20190119T034323_20190119T034348_025540_02D4E3_A870.SAFE",
    "estimatedDischargeLiters": 735000,
    "classProbabilities": {
      "Oil": 94.1,
      "Calm water": 2.0,
      "Natural film": 1.7,
      "Wake": 1.4,
      "Rain-related artifact": 0.5,
      "Unknown": 0.3
    },
    "polygonCoordinates": [
      [
        31.43844,
        31.977768
      ],
      [
        31.445685,
        31.97971
      ],
      [
        31.452929,
        31.981651
      ],
      [
        31.460174,
        31.983592
      ],
      [
        31.467418,
        31.985533
      ],
      [
        31.474663,
        31.987474
      ],
      [
        31.481907,
        31.989415
      ],
      [
        31.489152,
        31.991356
      ],
      [
        31.492424,
        31.996049
      ],
      [
        31.490134,
        32.004592
      ],
      [
        31.487845,
        32.013136
      ],
      [
        31.485556,
        32.02168
      ],
      [
        31.483267,
        32.030223
      ],
      [
        31.480977,
        32.038767
      ],
      [
        31.478688,
        32.047311
      ],
      [
        31.472063,
        32.04668
      ],
      [
        31.464818,
        32.044739
      ],
      [
        31.457574,
        32.042798
      ],
      [
        31.45033,
        32.040857
      ],
      [
        31.443085,
        32.038915
      ],
      [
        31.435841,
        32.036974
      ],
      [
        31.428596,
        32.035033
      ],
      [
        31.424132,
        32.031166
      ],
      [
        31.426422,
        32.022623
      ],
      [
        31.428711,
        32.014079
      ],
      [
        31.431,
        32.005535
      ],
      [
        31.43329,
        31.996992
      ],
      [
        31.435579,
        31.988448
      ],
      [
        31.437868,
        31.979904
      ],
      [
        31.43844,
        31.977768
      ]
    ]
  },
  "ow-0011": {
    "datasetKey": "ow-0011",
    "title": "Copernicus Sentinel-1 SAR ow-0011.jpg",
    "sceneId": "ow-0011.jpg",
    "imagePath": "/sar_images/ow-0011.jpg",
    "maskPath": "/true_masks/ow-0011.png",
    "areaSqKm": 4.7416,
    "perimeterKm": 6.7778,
    "eccentricity": 0.985,
    "dampingRatioDb": 9.36,
    "segmentationDiceScore": 0.716,
    "segmentationIouScore": 0.5576,
    "maxProbability": 0.9691,
    "oilLikelihoodScore": 0.941,
    "lookalikeScore": 0.059,
    "confidenceScore": 0.941,
    "center": [
      32.325878,
      31.379323
    ],
    "location": "Port Said Western Channel",
    "acquisitionStartUtc": "2019-01-22 15:56:10 UTC",
    "acquisitionStartIst": "2019-01-22 21:26:10 IST",
    "sentinelProduct": "S1B_IW_GRDH_1SDV_20190122T155610_20190122T155635_014609_01B404_24E9.SAFE",
    "estimatedDischargeLiters": 51000,
    "classProbabilities": {
      "Oil": 94.1,
      "Calm water": 2.0,
      "Natural film": 1.7,
      "Wake": 1.4,
      "Rain-related artifact": 0.5,
      "Unknown": 0.3
    },
    "polygonCoordinates": [
      [
        31.790307,
        31.914906
      ],
      [
        31.791661,
        31.914125
      ],
      [
        31.793014,
        31.913344
      ],
      [
        31.794367,
        31.912562
      ],
      [
        31.79572,
        31.911781
      ],
      [
        31.797073,
        31.911
      ],
      [
        31.798426,
        31.910219
      ],
      [
        31.79978,
        31.909437
      ],
      [
        31.801133,
        31.908656
      ],
      [
        31.802313,
        31.908825
      ],
      [
        31.803233,
        31.910419
      ],
      [
        31.804154,
        31.912014
      ],
      [
        31.805074,
        31.913608
      ],
      [
        31.805995,
        31.915202
      ],
      [
        31.806915,
        31.916796
      ],
      [
        31.805562,
        31.917578
      ],
      [
        31.804209,
        31.918359
      ],
      [
        31.802856,
        31.91914
      ],
      [
        31.801502,
        31.919921
      ],
      [
        31.800149,
        31.920703
      ],
      [
        31.798796,
        31.921484
      ],
      [
        31.797443,
        31.922265
      ],
      [
        31.79609,
        31.923046
      ],
      [
        31.79491,
        31.922877
      ],
      [
        31.793989,
        31.921283
      ],
      [
        31.793069,
        31.919689
      ],
      [
        31.792148,
        31.918095
      ],
      [
        31.791228,
        31.9165
      ],
      [
        31.790307,
        31.914906
      ]
    ]
  },
  "ow-0012": {
    "datasetKey": "ow-0012",
    "title": "Copernicus Sentinel-1 SAR ow-0012.jpg",
    "sceneId": "ow-0012.jpg",
    "imagePath": "/sar_images/ow-0012.jpg",
    "maskPath": "/true_masks/ow-0012.png",
    "areaSqKm": 3.4454,
    "perimeterKm": 6.1969,
    "eccentricity": 0.993,
    "dampingRatioDb": 9.36,
    "segmentationDiceScore": 0.721,
    "segmentationIouScore": 0.5637,
    "maxProbability": 0.9723,
    "oilLikelihoodScore": 0.941,
    "lookalikeScore": 0.059,
    "confidenceScore": 0.941,
    "center": [
      30.070983,
      31.506263
    ],
    "location": "Abu Qir Offshore Corridor",
    "acquisitionStartUtc": "2019-01-22 15:56:10 UTC",
    "acquisitionStartIst": "2019-01-22 21:26:10 IST",
    "sentinelProduct": "S1B_IW_GRDH_1SDV_20190122T155610_20190122T155635_014609_01B404_24E9.SAFE",
    "estimatedDischargeLiters": 37000,
    "classProbabilities": {
      "Oil": 94.1,
      "Calm water": 2.0,
      "Natural film": 1.7,
      "Wake": 1.4,
      "Rain-related artifact": 0.5,
      "Unknown": 0.3
    },
    "polygonCoordinates": [
      [
        32.253754,
        31.781284
      ],
      [
        32.254837,
        31.781909
      ],
      [
        32.255919,
        31.782534
      ],
      [
        32.257002,
        31.783159
      ],
      [
        32.258084,
        31.783784
      ],
      [
        32.259167,
        31.784409
      ],
      [
        32.260249,
        31.785034
      ],
      [
        32.261332,
        31.785659
      ],
      [
        32.26196,
        31.786446
      ],
      [
        32.261225,
        31.78772
      ],
      [
        32.260489,
        31.788994
      ],
      [
        32.259754,
        31.790267
      ],
      [
        32.259019,
        31.791541
      ],
      [
        32.258284,
        31.792814
      ],
      [
        32.257548,
        31.794088
      ],
      [
        32.256813,
        31.795361
      ],
      [
        32.256078,
        31.796635
      ],
      [
        32.254995,
        31.79601
      ],
      [
        32.253913,
        31.795385
      ],
      [
        32.25283,
        31.79476
      ],
      [
        32.251748,
        31.794135
      ],
      [
        32.250665,
        31.79351
      ],
      [
        32.249583,
        31.792885
      ],
      [
        32.2485,
        31.79226
      ],
      [
        32.247872,
        31.791473
      ],
      [
        32.248607,
        31.790199
      ],
      [
        32.249343,
        31.788925
      ],
      [
        32.250078,
        31.787652
      ],
      [
        32.250813,
        31.786378
      ],
      [
        32.251548,
        31.785105
      ],
      [
        32.252284,
        31.783831
      ],
      [
        32.253019,
        31.782558
      ],
      [
        32.253754,
        31.781284
      ]
    ]
  },
  "ow-0013": {
    "datasetKey": "ow-0013",
    "title": "Copernicus Sentinel-1 SAR ow-0013.jpg",
    "sceneId": "ow-0013.jpg",
    "imagePath": "/sar_images/ow-0013.jpg",
    "maskPath": "/true_masks/ow-0013.png",
    "areaSqKm": 0.7031,
    "perimeterKm": 2.905,
    "eccentricity": 0.887,
    "dampingRatioDb": 9.36,
    "segmentationDiceScore": 0.704,
    "segmentationIouScore": 0.5432,
    "maxProbability": 0.9675,
    "oilLikelihoodScore": 0.941,
    "lookalikeScore": 0.059,
    "confidenceScore": 0.941,
    "center": [
      31.66331,
      31.730417
    ],
    "location": "Baltim North EEZ Sector",
    "acquisitionStartUtc": "2019-01-22 15:56:10 UTC",
    "acquisitionStartIst": "2019-01-22 21:26:10 IST",
    "sentinelProduct": "S1B_IW_GRDH_1SDV_20190122T155610_20190122T155635_014609_01B404_24E9.SAFE",
    "estimatedDischargeLiters": 7560,
    "classProbabilities": {
      "Oil": 94.1,
      "Calm water": 2.0,
      "Natural film": 1.7,
      "Wake": 1.4,
      "Rain-related artifact": 0.5,
      "Unknown": 0.3
    },
    "polygonCoordinates": [
      [
        30.741939,
        31.59612
      ],
      [
        30.742561,
        31.596066
      ],
      [
        30.743184,
        31.596011
      ],
      [
        30.743807,
        31.595957
      ],
      [
        30.744429,
        31.595902
      ],
      [
        30.745052,
        31.595848
      ],
      [
        30.745674,
        31.595793
      ],
      [
        30.746297,
        31.595739
      ],
      [
        30.74692,
        31.595684
      ],
      [
        30.747542,
        31.59563
      ],
      [
        30.747886,
        31.595968
      ],
      [
        30.74795,
        31.596699
      ],
      [
        30.748013,
        31.59743
      ],
      [
        30.748077,
        31.598161
      ],
      [
        30.748141,
        31.598892
      ],
      [
        30.748205,
        31.599623
      ],
      [
        30.748269,
        31.600354
      ],
      [
        30.74799,
        31.600747
      ],
      [
        30.747367,
        31.600801
      ],
      [
        30.746745,
        31.600856
      ],
      [
        30.746122,
        31.60091
      ],
      [
        30.745499,
        31.600965
      ],
      [
        30.744877,
        31.601019
      ],
      [
        30.744254,
        31.601074
      ],
      [
        30.743632,
        31.601128
      ],
      [
        30.743009,
        31.601183
      ],
      [
        30.742386,
        31.601237
      ],
      [
        30.742322,
        31.600506
      ],
      [
        30.742258,
        31.599775
      ],
      [
        30.742195,
        31.599044
      ],
      [
        30.742131,
        31.598313
      ],
      [
        30.742067,
        31.597582
      ],
      [
        30.742003,
        31.596851
      ],
      [
        30.741939,
        31.59612
      ]
    ]
  },
  "ow-0014": {
    "datasetKey": "ow-0014",
    "title": "Copernicus Sentinel-1 SAR ow-0014.jpg",
    "sceneId": "ow-0014.jpg",
    "imagePath": "/sar_images/ow-0014.jpg",
    "maskPath": "/true_masks/ow-0014.png",
    "areaSqKm": 0.6281,
    "perimeterKm": 2.8093,
    "eccentricity": 0.912,
    "dampingRatioDb": 9.36,
    "segmentationDiceScore": 0.711,
    "segmentationIouScore": 0.5516,
    "maxProbability": 0.9698,
    "oilLikelihoodScore": 0.941,
    "lookalikeScore": 0.059,
    "confidenceScore": 0.941,
    "center": [
      30.349715,
      31.625116
    ],
    "location": "Rosetta Promontory Transit Route",
    "acquisitionStartUtc": "2019-01-22 15:56:10 UTC",
    "acquisitionStartIst": "2019-01-22 21:26:10 IST",
    "sentinelProduct": "S1B_IW_GRDH_1SDV_20190122T155610_20190122T155635_014609_01B404_24E9.SAFE",
    "estimatedDischargeLiters": 6750,
    "classProbabilities": {
      "Oil": 94.1,
      "Calm water": 2.0,
      "Natural film": 1.7,
      "Wake": 1.4,
      "Rain-related artifact": 0.5,
      "Unknown": 0.3
    },
    "polygonCoordinates": [
      [
        31.316058,
        31.707592
      ],
      [
        31.316259,
        31.707352
      ],
      [
        31.31646,
        31.707113
      ],
      [
        31.31666,
        31.706874
      ],
      [
        31.316861,
        31.706634
      ],
      [
        31.317062,
        31.706395
      ],
      [
        31.317263,
        31.706155
      ],
      [
        31.317464,
        31.705916
      ],
      [
        31.317665,
        31.705677
      ],
      [
        31.317866,
        31.705437
      ],
      [
        31.318067,
        31.705198
      ],
      [
        31.318267,
        31.704958
      ],
      [
        31.318468,
        31.704719
      ],
      [
        31.318669,
        31.70448
      ],
      [
        31.31887,
        31.70424
      ],
      [
        31.319071,
        31.704001
      ],
      [
        31.319272,
        31.703761
      ],
      [
        31.319473,
        31.703522
      ],
      [
        31.319754,
        31.703758
      ],
      [
        31.320035,
        31.703994
      ],
      [
        31.320317,
        31.70423
      ],
      [
        31.320598,
        31.704466
      ],
      [
        31.320879,
        31.704703
      ],
      [
        31.321161,
        31.704939
      ],
      [
        31.321442,
        31.705175
      ],
      [
        31.321724,
        31.705411
      ],
      [
        31.322005,
        31.705647
      ],
      [
        31.321804,
        31.705886
      ],
      [
        31.321603,
        31.706126
      ],
      [
        31.321402,
        31.706365
      ],
      [
        31.321201,
        31.706604
      ],
      [
        31.321001,
        31.706844
      ],
      [
        31.3208,
        31.707083
      ],
      [
        31.320599,
        31.707323
      ],
      [
        31.320398,
        31.707562
      ],
      [
        31.320197,
        31.707801
      ],
      [
        31.319996,
        31.708041
      ],
      [
        31.319795,
        31.70828
      ],
      [
        31.319594,
        31.70852
      ],
      [
        31.319394,
        31.708759
      ],
      [
        31.319193,
        31.708998
      ],
      [
        31.318992,
        31.709238
      ],
      [
        31.318791,
        31.709477
      ],
      [
        31.31859,
        31.709717
      ],
      [
        31.318309,
        31.70948
      ],
      [
        31.318027,
        31.709244
      ],
      [
        31.317746,
        31.709008
      ],
      [
        31.317465,
        31.708772
      ],
      [
        31.317183,
        31.708536
      ],
      [
        31.316902,
        31.7083
      ],
      [
        31.316621,
        31.708064
      ],
      [
        31.316339,
        31.707828
      ],
      [
        31.316058,
        31.707592
      ]
    ]
  },
  "ow-0015": {
    "datasetKey": "ow-0015",
    "title": "Copernicus Sentinel-1 SAR ow-0015.jpg",
    "sceneId": "ow-0015.jpg",
    "imagePath": "/sar_images/ow-0015.jpg",
    "maskPath": "/true_masks/ow-0015.png",
    "areaSqKm": 60.5976,
    "perimeterKm": 28.9866,
    "eccentricity": 0.963,
    "dampingRatioDb": 9.36,
    "segmentationDiceScore": 0.748,
    "segmentationIouScore": 0.5974,
    "maxProbability": 0.9835,
    "oilLikelihoodScore": 0.941,
    "lookalikeScore": 0.059,
    "confidenceScore": 0.941,
    "center": [
      31.346989,
      32.878615
    ],
    "location": "Levantine Deep Water Northern Basin",
    "acquisitionStartUtc": "2019-01-22 15:56:41 UTC",
    "acquisitionStartIst": "2019-01-22 21:26:41 IST",
    "sentinelProduct": "S1B_IW_GRDH_1SDV_20190122T155641_20190122T155706_014609_01B404_992E.SAFE",
    "estimatedDischargeLiters": 650000,
    "classProbabilities": {
      "Oil": 94.1,
      "Calm water": 2.0,
      "Natural film": 1.7,
      "Wake": 1.4,
      "Rain-related artifact": 0.5,
      "Unknown": 0.3
    },
    "polygonCoordinates": [
      [
        32.54576,
        31.943975
      ],
      [
        32.54951,
        31.950471
      ],
      [
        32.551515,
        31.956891
      ],
      [
        32.555265,
        31.963386
      ],
      [
        32.559015,
        31.969881
      ],
      [
        32.562765,
        31.976376
      ],
      [
        32.566515,
        31.982872
      ],
      [
        32.570265,
        31.989367
      ],
      [
        32.574015,
        31.995862
      ],
      [
        32.574438,
        32.001752
      ],
      [
        32.56678,
        32.006173
      ],
      [
        32.559122,
        32.010595
      ],
      [
        32.551465,
        32.015016
      ],
      [
        32.543807,
        32.019437
      ],
      [
        32.536149,
        32.023858
      ],
      [
        32.531911,
        32.018728
      ],
      [
        32.528161,
        32.012233
      ],
      [
        32.524411,
        32.005737
      ],
      [
        32.520661,
        31.999242
      ],
      [
        32.516911,
        31.992747
      ],
      [
        32.513161,
        31.986252
      ],
      [
        32.509411,
        31.979757
      ],
      [
        32.507562,
        31.973607
      ],
      [
        32.51522,
        31.969186
      ],
      [
        32.522877,
        31.964765
      ],
      [
        32.526576,
        31.959381
      ],
      [
        32.52853,
        31.953923
      ],
      [
        32.536188,
        31.949502
      ],
      [
        32.543846,
        31.945081
      ],
      [
        32.54576,
        31.943975
      ]
    ]
  }
};

export function getDartisKey(sceneId?: string): string | null {
  if (!sceneId) return 'ow-0001';
  const clean = sceneId.toLowerCase();
  for (let i = 15; i >= 1; i--) {
    const k = `ow-${String(i).padStart(4, '0')}`;
    const patterns = [
      k,
      `ow_${String(i).padStart(4, '0')}`,
      `ow${String(i).padStart(4, '0')}`,
      `ow-${String(i).padStart(2, '0')}`,
      `ow_${String(i).padStart(2, '0')}`,
      `ow${String(i).padStart(2, '0')}`,
      `ow-${i}`,
      `ow_${i}`,
      `ow${i}`
    ];
    if (patterns.some(p => clean.includes(p))) {
      return k;
    }
  }
  const match = clean.match(/(?:^|[^\d])0*([1-9]|1[0-5])(?:[^\d]|$)/);
  if (match) {
    const val = parseInt(match[1], 10);
    return `ow-${String(val).padStart(4, '0')}`;
  }
  return null;
}

export function getDartisMaskDataUrl(sceneId?: string): string {
  const k = getDartisKey(sceneId);
  if (k && DARTIS_MASKS[k]) {
    return DARTIS_MASKS[k];
  }
  return DARTIS_MASKS['ow-0001'];
}

export function getDartisBenchmark(sceneId?: string): DartisBenchmarkInfo {
  const k = getDartisKey(sceneId) || 'ow-0001';
  return DARTIS_BENCHMARKS[k] || DARTIS_BENCHMARKS['ow-0001'];
}
