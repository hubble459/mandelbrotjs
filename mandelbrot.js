class Mandelbrot {
    ORG_THRESHOLD = 50;
    QUALITY = 100;
    canvas;
    context;
    fgContext;
    width;
    height;

    // Menu
    menuIterations;
    menuScale;
    menuXOffset;
    menuYOffset;

    xOffset = 0;
    yOffset = 0;
    scale = 1;
    quality = this.QUALITY;
    loading = false;
    stop = false;
    stopPoint = -1;
    lastRefresh;
    threshold = 50;


    constructor() {
        this.canvas = document.createElement('canvas');
        this.foregroundCanvas = document.createElement('canvas');
        document.body.appendChild(this.canvas);
        document.body.appendChild(this.foregroundCanvas);

        window.addEventListener('resize', () => {
            this.resize();
        });

        window.addEventListener('keydown', async (event) => {
            switch (event.key) {
                case 'z':
                    this.zoom(false);
                    break;
                case 'x':
                    this.zoom(true);
                    break;
            }
        });

        this.foregroundCanvas.addEventListener('mousemove', (event) => {
            this.mouseData(event);
        });

        this.foregroundCanvas.addEventListener('mousedown', (event) => {
            this.mouseClick(event);
        });

        this.foregroundCanvas.addEventListener('mousewheel', (event) => {
            this.mouseScroll(event);
        });

        let save = localStorage.getItem('save');
        if (save) {
            save = JSON.parse(save);
            this.scale = save.scale;
            this.xOffset = save.xOffset;
            this.yOffset = save.yOffset;
        }

        this.createMenu();
        this.resize();
    }

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        this.context = this.canvas.getContext('2d');

        this.foregroundCanvas.width = window.innerWidth;
        this.foregroundCanvas.height = window.innerHeight;
        this.fgContext = this.foregroundCanvas.getContext('2d');

        this.width = this.context.canvas.width + this.context.canvas.width % (100 / this.quality);
        this.height = this.context.canvas.height + this.context.canvas.height % (100 / this.quality);

        this.refresh();
    }

    refresh() {
        this.threshold = this.ORG_THRESHOLD * Math.max(1, (Math.log2(this.scale) + 1));

        const save = {
            scale: this.scale,
            xOffset: this.xOffset,
            yOffset: this.yOffset
        };
        localStorage.setItem('save', JSON.stringify(save));

        clearTimeout(this.lastRefresh);
        this.lastRefresh = setTimeout(() => {
            this.mandelbrot().then((time) => {
                if (time !== -1) {
                    console.log(`Loaded in ${time} milliseconds!`);
                }
            });
        }, 750);
    }


    drawDot(x, y, iterations) {
        if (iterations === this.threshold) {
            this.context.fillStyle = '#000';
        } else {
            const filters = [
                this.blueFilter,
                this.colorFilter,
                this.grayFilter,
                this.hsvFilter
            ]
            const filter = filters[3];

            this.context.fillStyle = filter.call(this, iterations);
        }

        const size = 100 / this.quality;
        const halfSize = size / 2;
        this.context.fillRect(x, y, size + halfSize, size + halfSize);
    }

    blueFilter(iterations) {
        const color = Math.floor((iterations / this.threshold) * 256);
        const hex = Math.floor(color).toString(16);
        return '#' + ('0'.repeat(Math.max(6 - hex.length, 0)) + hex).substring(0, 6);
    }

    colorFilter(iterations) {
        const color = Math.floor((iterations / this.threshold) * 256);
        const hex = Math.pow(color, 4).toString(16);
        return '#' + ('0'.repeat(Math.max(6 - hex.length, 0)) + hex).substring(0, 6);
    }

    grayFilter(iterations) {
        const color = Math.floor((iterations / this.threshold) * 256);
        const hex = color.toString(16).substring(0, 2);
        return '#' + (hex.repeat(2) + hex).substring(0, 6);
    }

    hsvFilter(iterations) {
        const color = Math.floor((256 / this.threshold * iterations));
        const s = 1 / this.threshold * iterations
        const v = 1 / this.threshold * iterations;
        const {r, g, b} = this.HSVtoRGB(color / 125, s, v);
        return `rgb(${r},${g},${b})`
    }

    async mandelbrot(slow = true) {
        if (this.loading) {
            if (this.stop) {
                this.stopPoint = -1;
            } else {
                this.stop = true;
                const handle = setInterval(() => {
                    if (!this.loading) {
                        this.stop = false;
                        clearInterval(handle);
                        this.mandelbrot(slow).then((time) => {
                            if (time !== -1) {
                                console.log(`Loaded in ${time} milliseconds!`);
                                this.stopPoint = -1;
                            }
                        });
                    }
                }, 500)
            }
            return -1;
        }
        this.loading = true;
        const start = Date.now();
        for (let j = 0; j <= this.height; j += 100 / this.quality) {
            for (let i = 0; i <= this.width; i += 100 / this.quality) {
                const {x, y} = this.scaled(i, j);
                const color = this.mandelbrotCalculation(x, y);
                this.drawDot(i, j, color);
            }
            if (slow && j % (100 - this.quality) === 0) {
                await this.sleep(1);
            }
            if (this.stop && this.stopPoint === -1) {
                this.stopPoint = j;
            } else if (j === this.stopPoint) {
                break;
            }
        }
        this.loading = false;
        return Date.now() - start;
    }

    async sleep(millis) {
        return new Promise(resolve => setTimeout(resolve, millis));
    }

    mandelbrotCalculation(x0, y0, path) {
        let x = x0;
        let y = y0;
        const pathArray = [{x, y}];
        let iterations = 0;
        while (x * x + y * y <= 4 && ++iterations < this.threshold) {
            const xTmp = x * x - y * y + x0;
            y = 2 * x * y + y0;
            x = xTmp;

            if (path) {
                pathArray.unshift({x, y});
                if (pathArray.length > 50) {
                    pathArray.pop();
                }
            }
        }

        if (!path) {
            return iterations;
        } else {
            return {iterations, pathArray}
        }
    }

    scaled(i, j) {
        return {
            x: i / this.width * 3.5 / this.scale - 2.5 / this.scale + this.xOffset,
            y: j / this.height * 2 / this.scale - 1 / this.scale - this.yOffset
        };
    }

    unscaled(x, y) {
        return {
            i: Math.floor(((x - this.xOffset) * this.scale + 2.5) / 3.5 * this.width),
            j: Math.floor(((y + this.yOffset) * this.scale + 1) * this.height * .5)
        };
    }

    mouseData({x: i, y: j}) {
        let {x, y} = this.scaled(i, j);
        const data = this.mandelbrotCalculation(x, y, true);
        if (x.toString().startsWith('0')) {
            x = Math.abs(x);
        }
        if (y.toString().startsWith('0')) {
            y = Math.abs(y);
        }
        this.menuIterations.innerText = 'Iterations: ' + data.iterations;
        try {
            this.menuXOffset.innerText = 'xOffset: ' + x.toPrecision(Math.min(12, this.scale));
        } catch (e) {
        }
        try {
            this.menuYOffset.innerText = 'yOffset: ' + y.toPrecision(Math.min(12, this.scale));
        } catch (e) {
        }

        this.fgContext.clearRect(0, 0, this.foregroundCanvas.width, this.foregroundCanvas.height);
        this.fgContext.beginPath();
        for (let {x, y} of data.pathArray) {
            const {i, j} = this.unscaled(x, y);
            this.fgContext.lineTo(i, j);
            this.fgContext.strokeStyle = 'red';
            this.fgContext.stroke();
        }
    }

    mouseClick({x: i, y: j}) {
        const {x, y} = this.scaled(i, j);
        this.xOffset = x - (-.75 / this.scale);
        this.yOffset = -y;
        this.refresh();
    }

    mouseScroll({deltaY}) {
        this.zoom(deltaY > 0);
    }

    zoom(out) {
        const {x} = this.scaled(this.width / 2, this.height / 2);
        if (out) {
            this.scale /= 2;
        } else {
            this.scale *= 2;
        }
        this.xOffset = x - (-.75 / this.scale);
        this.menuScale.innerText = `Scale: ${this.scale}`;

        this.refresh();
    }

    createMenu() {
        // Add css
        const css = document.createElement('link');
        css.rel = 'stylesheet';
        css.href = './mandelbrot.css';
        document.head.appendChild(css);

        // Add menu box
        const div = document.createElement('div');
        div.classList.add('mandelbrot-menu');
        document.body.appendChild(div);

        // Add iterations paragraph
        this.menuIterations = document.createElement('p');
        this.menuIterations.innerText = 'Iterations: 0';
        div.appendChild(this.menuIterations);

        // Add scale
        this.menuScale = document.createElement('p');
        this.menuScale.innerText = `Scale: ${this.scale}`;
        div.appendChild(this.menuScale);

        // Add xOffset
        this.menuXOffset = document.createElement('p');
        this.menuXOffset.innerText = 'xOffset: 0';
        div.appendChild(this.menuXOffset);

        // Add yOffset
        this.menuYOffset = document.createElement('p');
        this.menuYOffset.innerText = 'yOffset: 0';
        div.appendChild(this.menuYOffset);

        // Add quality
        this.menuQuality = document.createElement('p');
        this.menuQuality.innerText = `Quality: ${this.quality}`;
        div.appendChild(this.menuQuality);
    }

    HSVtoRGB(h, s, v) {
        let r, g, b, i, f, p, q, t;
        i = Math.floor(h * 6);
        f = h * 6 - i;
        p = v * (1 - s);
        q = v * (1 - f * s);
        t = v * (1 - (1 - f) * s);
        switch (i % 6) {
            case 0:
                r = v, g = t, b = p;
                break;
            case 1:
                r = q, g = v, b = p;
                break;
            case 2:
                r = p, g = v, b = t;
                break;
            case 3:
                r = p, g = q, b = v;
                break;
            case 4:
                r = t, g = p, b = v;
                break;
            case 5:
                r = v, g = p, b = q;
                break;
        }
        return {
            r: Math.round(r * 255),
            g: Math.round(g * 255),
            b: Math.round(b * 255)
        };
    }
}
