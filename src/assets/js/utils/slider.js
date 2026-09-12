'use strict';

export default class Slider {
    constructor(id, minValue, maxValue) {
        this.startX = 0;
        this.x = 0;

        this.slider = document.querySelector(id);
        this.touchLeft = this.slider.querySelector('.slider-touch-left');
        this.touchRight = this.slider.querySelector('.slider-touch-right');
        this.lineSpan = this.slider.querySelector('.slider-line span');

        this.min = parseFloat(this.slider.getAttribute('min'));
        this.max = parseFloat(this.slider.getAttribute('max'));

        if (minValue === undefined || minValue === null) minValue = this.min;
        if (maxValue === undefined || maxValue === null) maxValue = this.max;

        this.minValue = parseFloat(minValue);
        this.maxValue = parseFloat(maxValue);

        this.step = parseFloat(this.slider.getAttribute('step')) || 1;

        this.normalizeFact = 18;

        this.reset();

        this.maxX = this.slider.offsetWidth - this.touchRight.offsetWidth;
        this.selectedTouch = null;
        this.initialValue = this.lineSpan.offsetWidth - this.normalizeFact;

        this.setMinValue(this.minValue);
        this.setMaxValue(this.maxValue);
        this.updateLabels(this.minValue, this.maxValue);

        this.touchLeft.addEventListener('mousedown', event => this.onStart(this.touchLeft, event));
        this.touchRight.addEventListener('mousedown', event => this.onStart(this.touchRight, event));
        this.touchLeft.addEventListener('touchstart', event => this.onStart(this.touchLeft, event));
        this.touchRight.addEventListener('touchstart', event => this.onStart(this.touchRight, event));
    }

    reset() {
        this.touchLeft.style.left = '0px';
        this.touchRight.style.left = (this.slider.offsetWidth - this.touchLeft.offsetWidth) + 'px';
        this.lineSpan.style.marginLeft = '0px';
        this.lineSpan.style.width = (this.slider.offsetWidth - this.touchLeft.offsetWidth) + 'px';
        this.startX = 0;
        this.x = 0;
    }

    setMinValue(minValue) {
        let ratio = (minValue - this.min) / (this.max - this.min);

        this.touchLeft.style.left =
            Math.ceil(
                ratio * (
                    this.slider.offsetWidth -
                    (this.touchLeft.offsetWidth + this.normalizeFact)
                )
            ) + 'px';

        this.lineSpan.style.marginLeft = this.touchLeft.offsetLeft + 'px';
        this.lineSpan.style.width =
            (this.touchRight.offsetLeft - this.touchLeft.offsetLeft) + 'px';

        this.updateLabels(minValue, this.maxValue);
    }

    setMaxValue(maxValue) {
        let ratio = (maxValue - this.min) / (this.max - this.min);

        this.touchRight.style.left =
            Math.ceil(
                ratio * (
                    this.slider.offsetWidth -
                    (this.touchLeft.offsetWidth + this.normalizeFact)
                ) + this.normalizeFact
            ) + 'px';

        this.lineSpan.style.marginLeft = this.touchLeft.offsetLeft + 'px';
        this.lineSpan.style.width =
            (this.touchRight.offsetLeft - this.touchLeft.offsetLeft) + 'px';

        this.updateLabels(this.minValue, maxValue);
    }

    updateLabels(minValue, maxValue) {
        const leftLabel = this.touchLeft.querySelector('span');
        const rightLabel = this.touchRight.querySelector('span');

        if (leftLabel) {
            leftLabel.setAttribute('value', `${this.formatValue(minValue)} GB`);
        }

        if (rightLabel) {
            rightLabel.setAttribute('value', `${this.formatValue(maxValue)} GB`);
        }
    }

    formatValue(value) {
        const number = parseFloat(value);

        if (Number.isInteger(number)) {
            return number;
        }

        return number.toFixed(1).replace(/\.0$/, '');
    }

    onStart(elem, event) {
        event.preventDefault();

        if (elem === this.touchLeft) {
            this.x = this.touchLeft.offsetLeft;
        } else {
            this.x = this.touchRight.offsetLeft;
        }

        const pageX = event.touches ? event.touches[0].pageX : event.pageX;

        this.startX = pageX - this.x;
        this.selectedTouch = elem;

        this.func1 = event => this.onMove(event);
        this.func2 = event => this.onStop(event);

        document.addEventListener('mousemove', this.func1);
        document.addEventListener('mouseup', this.func2);
        document.addEventListener('touchmove', this.func1, { passive: false });
        document.addEventListener('touchend', this.func2);
    }

    onMove(event) {
        if (event.touches) {
            event.preventDefault();
        }

        const pageX = event.touches ? event.touches[0].pageX : event.pageX;

        this.x = pageX - this.startX;

        if (this.selectedTouch === this.touchLeft) {
            if (this.x > this.touchRight.offsetLeft - this.selectedTouch.offsetWidth - 24) {
                this.x =
                    this.touchRight.offsetLeft -
                    this.selectedTouch.offsetWidth -
                    24;
            } else if (this.x < 0) {
                this.x = 0;
            }

            this.selectedTouch.style.left = this.x + 'px';
        } else if (this.selectedTouch === this.touchRight) {
            if (this.x < this.touchLeft.offsetLeft + this.touchLeft.offsetWidth + 24) {
                this.x =
                    this.touchLeft.offsetLeft +
                    this.touchLeft.offsetWidth +
                    24;
            } else if (this.x > this.maxX) {
                this.x = this.maxX;
            }

            this.selectedTouch.style.left = this.x + 'px';
        }

        this.lineSpan.style.marginLeft = this.touchLeft.offsetLeft + 'px';
        this.lineSpan.style.width =
            this.touchRight.offsetLeft - this.touchLeft.offsetLeft + 'px';

        this.calculateValue();
    }

    onStop(event) {
        document.removeEventListener('mousemove', this.func1);
        document.removeEventListener('mouseup', this.func2);
        document.removeEventListener('touchmove', this.func1);
        document.removeEventListener('touchend', this.func2);

        this.selectedTouch = null;

        this.calculateValue();
    }

    calculateValue() {
        let newValue =
            (this.lineSpan.offsetWidth - this.normalizeFact) /
            this.initialValue;

        let minValue =
            this.lineSpan.offsetLeft /
            this.initialValue;

        let maxValue =
            minValue +
            newValue;

        minValue =
            minValue *
            (this.max - this.min) +
            this.min;

        maxValue =
            maxValue *
            (this.max - this.min) +
            this.min;

        if (this.step !== 0) {
            let multi = Math.floor(minValue / this.step);
            this.minValue = this.step * multi;

            multi = Math.floor(maxValue / this.step);
            this.maxValue = this.step * multi;
        } else {
            this.minValue = minValue;
            this.maxValue = maxValue;
        }

        this.updateLabels(this.minValue, this.maxValue);

        this.emit(
            'change',
            this.minValue,
            this.maxValue
        );
    }

    func = [];

    on(name, func) {
        this.func[name] = func;
    }

    emit(name, ...args) {
        if (this.func[name]) {
            this.func[name](...args);
        }
    }
}