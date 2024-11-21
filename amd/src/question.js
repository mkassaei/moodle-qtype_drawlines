// This file is part of Moodle - http://moodle.org/
//
// Moodle is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// Moodle is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with Moodle.  If not, see <http://www.gnu.org/licenses/>.

/**
 * JavaScript to allow dragging options for lines (using mouse down or touch) or tab through lines using keyboard.
 *
 * @module     qtype_drawlines/question
 * @copyright  2024 The Open University
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

define([
    'jquery',
    'core/dragdrop',
    'qtype_drawlines/line',
    'core/key_codes',
    'core_form/changechecker',
], function(
    $,
    dragDrop,
    Line,
) {

    "use strict";

    /**
     * Object to handle one drag-drop markers question.
     *
     * @param {String} containerId id of the outer div for this question.
     * @param {boolean} readOnly whether the question is being displayed read-only.
     * @param {Object[]} visibleDropZones the geometry of any drop-zones to show.
     *      Objects have fields line, coords and markertext.
     * @param {line[]} questionLines
     * @constructor
     */
    function DrawlinesQuestion(containerId, readOnly, visibleDropZones, questionLines) {
        var thisQ = this;
        this.containerId = containerId;
        this.visibleDropZones = visibleDropZones;
        this.questionLines = questionLines;
        this.lineSVGs = [];
        this.lines = [];
        this.svgEl = null;
        if (readOnly) {
            this.getRoot().classList.add('qtype_drawlines-readonly');
        }
        let bgImage = this.bgImage();
        thisQ.createSvgOnImageLoad(bgImage);
    }

    /**
     * Update the coordinates from a particular string.
     */
    DrawlinesQuestion.prototype.updateCoordinates = function() {
        // We don't need to scale the shape for editing form.
        for (var line = 0; line < this.lineSVGs.length; line++) {
            var coordinates = this.getSVGLineCoordinates(this.lineSVGs[line]);
            if (!this.lines[line].parse(coordinates[0], coordinates[1], 1)) {
                // Invalid coordinates. Don't update the preview.
                return;
            }
            this.updateSvgEl(line);
        }
    };

    /**
     * Parse the coordinates from a particular string.
     *
     * @param {String} coordinates The coordinates to be parsed. The values are in the format: x1,y1 x2,y2.
     *                             Except for infinite line type where it's in the format x1,y1 x2,y2, x3,y3, x4,y4.
     *                             Here, x1,y1 and x4,y4 are the two very end points of the infinite line and
     *                             x2,y2 and x3,y3 are the pints with the handles.
     * @param {String} lineType The type of the line.
     */
    DrawlinesQuestion.prototype.parseCoordinates = function(coordinates, lineType) {
        var bits = coordinates.split(' ');
        if (lineType === 'lineinfinite' && bits.length !== 2) {
            // Remove the first and last coordinates.
            bits = bits.slice(1, -1);
        }
        if (bits.length !== 2) {
            throw new Error(coordinates + ' is not a valid point');
        }
        return bits;
    };

    /**
     * Draws the svg lines of any drop zones that should be visible for feedback purposes.
     */
    DrawlinesQuestion.prototype.drawDropzone = function() {
        var bgImage = this.bgImage();
        var svg = this.getRoot().querySelector('svg.dropzones');
        var rootElement = this.getRoot();
        rootElement.querySelector('.que-dlines-dropzone').style.position = 'relative';
        rootElement.querySelector('.que-dlines-dropzone').style.top = (bgImage.height + 1) * -1 + "px";
        rootElement.querySelector('.que-dlines-dropzone').style.height = bgImage.height + "px";
        rootElement.querySelector('.droparea').style.height = bgImage.height + "px";
        if (!svg) {
            var dropZone = this.getRoot().querySelector('.que-dlines-dropzone');
            dropZone.innerHTML =
                '<svg xmlns="http://www.w3.org/2000/svg" ' +
                    'class= "dropzones" ' +
                    'width="' + bgImage.width + '" ' +
                    'height="' + bgImage.height + '" ' +
                '></svg>';
        }
        this.drawSVGLines(this.questionLines);
    };

    /**
     * Draws the svg lines of any drop zones.
     *
     * @param {Object[]} questionLines
     */
    DrawlinesQuestion.prototype.drawSVGLines = function(questionLines) {
        var bgImage = this.bgImage(),
            height, startcoordinates, endcoordinates, draginitialcoords;

        var drags = this.getRoot().querySelector('.draghomes');
        drags.innerHTML =
            '<svg xmlns="http://www.w3.org/2000/svg" class="dragshome" ' +
            'width="' + bgImage.width + '" ' +
            'height="' + questionLines.length * 50 + '"' +
            '></svg>';

        var draghomeSvg = this.getRoot().querySelector('.dragshome');
        var dropzoneSvg = this.getRoot().querySelector('.dropzones');
        var initialHeight = 25;
        for (let line = 0; line < questionLines.length; line++) {
            height = initialHeight + line * 50;
            startcoordinates = '50,' + height + ';10';
            endcoordinates = '200,' + height + ';10';

            // Check if the lines are to be set with initial coordinates.
            draginitialcoords = this.visibleDropZones['c' + line];
            if (draginitialcoords !== undefined && draginitialcoords !== '') {
                // The visibleDropZones array holds the response in the format x1,y1 x2,y2 - to be added to svgdropzone.
                var coords = this.parseCoordinates(draginitialcoords, questionLines[line].type);
                startcoordinates = coords[0] + ';10';
                endcoordinates = coords[1] + ';10';
                this.lines[line] = Line.make(
                    [startcoordinates, endcoordinates],
                    [questionLines[line].labelstart, questionLines[line].labelend],
                    questionLines[line].type
                );
                this.addToSvg(line, dropzoneSvg);
            } else {
                // Need to be added to draghomeSvg.
                this.lines[line] = Line.make(
                    [startcoordinates, endcoordinates],
                    [questionLines[line].labelstart, questionLines[line].labelend],
                    questionLines[line].type
                );
                this.addToSvg(line, draghomeSvg);
            }
        }
    };

    // TODO: The below methods can be refractored for window resizing.
    //
    // /**
    //  * Adds a dropzone line with colour, coords and link provided to the array of Lines.
    //  *
    //  * @param {jQuery} svg the SVG image to which to add this drop zone.
    //  * @param {int} dropZoneNo which drop-zone to add.
    //  * @param {string} colourClass class name
    //  */
    // DrawlinesQuestion.prototype.addDropzone = function(svg, dropZoneNo, colourClass) {
    //     var dropZone = this.visibleDropZones[dropZoneNo],
    //         line = Line.make(dropZone.line, ''),
    //         existingmarkertext,
    //         bgRatio = this.bgRatio();
    //     if (!line.parse(dropZone.coords, bgRatio)) {
    //         return;
    //     }
    //
    //     existingmarkertext = this.getRoot().find('div.markertexts span.markerlabelstart' + dropZoneNo);
    //     if (existingmarkertext.length) {
    //         if (dropZone.markertext !== '') {
    //             existingmarkertext.html(dropZone.markertext);
    //         } else {
    //             existingmarkertext.remove();
    //         }
    //     } else if (dropZone.markertext !== '') {
    //         var classnames = 'markertext markertext' + dropZoneNo;
    //         this.getRoot().find('div.markertexts').append('<span class="' + classnames + '">' +
    //             dropZone.markertext + '</span>');
    //         var markerspan = this.getRoot().find('div.ddarea div.markertexts span.markertext' + dropZoneNo);
    //         if (markerspan.length) {
    //             var handles = line.getHandlePositions();
    //             var positionLeft = handles.moveHandles.x - (markerspan.outerWidth() / 2) - 4;
    //             var positionTop = handles.moveHandles.y - (markerspan.outerHeight() / 2);
    //             markerspan
    //                 .css('left', positionLeft)
    //                 .css('top', positionTop);
    //             markerspan
    //                 .data('originX', markerspan.position().left / bgRatio)
    //                 .data('originY', markerspan.position().top / bgRatio);
    //             this.handleElementScale(markerspan, 'center');
    //         }
    //     }
    //
    //     var lineSVG = line.makeSvg(svg[0]);
    //     lineSVG.setAttribute('class', 'dropzone ' + colourClass);
    //
    //     this.lines[this.Line.length] = line;
    //     this.lineSVGs[this.lineSVGs.length] = lineSVG;
    // };

    // /**
    //  * Draws the drag items on the page (and drop zones if required).
    //  * The idea is to re-draw all the drags and drops whenever there is a change
    //  * like a widow resize or an item dropped in place.
    //  */
    // DrawlinesQuestion.prototype.repositionDrags = function() {
    //     var root = this.getRoot(),
    //         thisQ = this;
    //
    //     root.find('div.draghomes .marker').not('.dragplaceholder').each(function(key, item) {
    //         $(item).addClass('unneeded');
    //     });
    //
    //     root.find('input.choices').each(function(key, input) {
    //         var choiceNo = thisQ.getChoiceNoFromElement(input),
    //             imageCoords = thisQ.getImageCoords(input);
    //
    //         if (imageCoords.length) {
    //             var drag = thisQ.getRoot().find('.draghomes' + ' span.marker' + '.choice' + choiceNo).not('.dragplaceholder');
    //             drag.remove();
    //             for (var i = 0; i < imageCoords.length; i++) {
    //                 var dragInDrop = drag.clone();
    //                 // Convert image coords to screen coords.
    //                 const screenCoords = thisQ.convertToWindowXY(imageCoords[i]);
    //                 dragInDrop.data('pagex', screenCoords.x).data('pagey', screenCoords.y);
    //                 // Save image coords to the drag item so we can use it later.
    //                 dragInDrop.data('imageCoords', imageCoords[i]);
    //                 // We always save the coordinates in the 1:1 ratio.
    //                 // So we need to set the scale ratio to 1 for the initial load.
    //                 dragInDrop.data('scaleRatio', 1);
    //                 thisQ.sendDragToDrop(dragInDrop, false, true);
    //             }
    //             thisQ.getDragClone(drag).addClass('active');
    //             thisQ.cloneDragIfNeeded(drag);
    //         }
    //     });
    //
    //     // Save the question answer.
    //     thisQ.questionAnswer = thisQ.getQuestionAnsweredValues();
    // };
    //
    // /**
    //  * Determine what drag items need to be shown and
    //  * return coords of all drag items except any that are currently being dragged
    //  * based on contents of hidden inputs and whether drags are 'infinite' or how many
    //  * drags should be shown.
    //  *
    //  * @param {jQuery} inputNode
    //  * @returns {Point[]} image coordinates of however many copies of the drag item should be shown.
    //  */
    // DrawlinesQuestion.prototype.getImageCoords = function(inputNode) {
    //     var imageCoords = [],
    //         val = $(inputNode).val();
    //     if (val !== '') {
    //         var coordsStrings = val.split(' ');
    //         for (var i = 0; i < coordsStrings.length; i++) {
    //             imageCoords[i] = Line.Point.parse(coordsStrings[i]);
    //         }
    //     }
    //     return imageCoords;
    // };
    //
    // /**
    //  * Converts the relative x and y position coordinates into
    //  * absolute x and y position coordinates.
    //  *
    //  * @param {Point} point relative to the background image.
    //  * @returns {Point} point relative to the page.
    //  */
    // DrawlinesQuestion.prototype.convertToWindowXY = function(point) {
    //     var bgImage = this.bgImage();
    //     // The +1 seems rather odd, but seems to give the best results in
    //     // the three main browsers at a range of zoom levels.
    //     // (Its due to the 1px border around the image, that shifts the
    //     // image pixels by 1 down and to the left.)
    //     return point.offset(bgImage.offset().left + 1, bgImage.offset().top + 1);
    // };

    // /**
    //  * Utility function converting window coordinates to relative to the
    //  * background image coordinates.
    //  *
    //  * @param {Point} point relative to the page.
    //  * @returns {Point} point relative to the background image.
    //  */
    // DrawlinesQuestion.prototype.convertToBgImgXY = function(point) {
    //     var bgImage = this.bgImage();
    //     return point.offset(-bgImage.offset().left - 1, -bgImage.offset().top - 1);
    // };
    //
    // /**
    //  * Functionality at the end of a drag drop.
    //  * @param {jQuery} dragged the marker that was dragged.
    //  */
    // DrawlinesQuestion.prototype.dragEnd = function(dragged) {
    //     var placed = false,
    //         choiceNo = this.getChoiceNoFromElement(dragged),
    //         bgRatio = this.bgRatio(),
    //         dragXY;
    //
    //     dragged.data('pagex', dragged.offset().left).data('pagey', dragged.offset().top);
    //     dragXY = new Line.Point(dragged.data('pagex'), dragged.data('pagey'));
    //     if (this.coordsInBgImg(dragXY)) {
    //         this.sendDragToDrop(dragged, true);
    //         placed = true;
    //         // Since we already move the drag item to new position.
    //         // Remove the image coords if this drag item have it.
    //         // We will get the new image coords for this drag item in saveCoordsForChoice.
    //         if (dragged.data('imageCoords')) {
    //             dragged.data('imageCoords', null);
    //         }
    //         // It seems that the dragdrop sometimes leaves the drag
    //         // one pixel out of position. Put it in exactly the right place.
    //         var bgImgXY = this.convertToBgImgXY(dragXY);
    //         bgImgXY = new Line.Point(bgImgXY.x / bgRatio, bgImgXY.y / bgRatio);
    //         dragged.data('originX', bgImgXY.x).data('originY', bgImgXY.y);
    //     }
    //
    //     if (!placed) {
    //         this.sendDragHome(dragged);
    //         this.removeDragIfNeeded(dragged);
    //     } else {
    //         this.cloneDragIfNeeded(dragged);
    //     }
    //
    //     this.saveCoordsForChoice(choiceNo);
    // };
    //
    // /**
    //  * Makes sure the dragged item always exists within the background image area.
    //  *
    //  * @param {Point} windowxy
    //  * @returns {Point} coordinates
    //  */
    // DrawlinesQuestion.prototype.constrainToBgImg = function(windowxy) {
    //     var bgImg = this.bgImage(),
    //         bgImgXY = this.convertToBgImgXY(windowxy);
    //     bgImgXY.x = Math.max(0, bgImgXY.x);
    //     bgImgXY.y = Math.max(0, bgImgXY.y);
    //     bgImgXY.x = Math.min(bgImg.width(), bgImgXY.x);
    //     bgImgXY.y = Math.min(bgImg.height(), bgImgXY.y);
    //     return this.convertToWindowXY(bgImgXY);
    // };

    //
    // /**
    //  * Handle when the window is resized.
    //  */
    // DrawlinesQuestion.prototype.handleResize = function() {
    //     var thisQ = this,
    //         bgRatio = this.bgRatio();
    //     if (this.isPrinting) {
    //         bgRatio = 1;
    //     }
    //
    //     this.getRoot().find('div.droparea .marker').not('.beingdragged').each(function(key, drag) {
    //         $(drag)
    //             .css('left', parseFloat($(drag).data('originX')) * parseFloat(bgRatio))
    //             .css('top', parseFloat($(drag).data('originY')) * parseFloat(bgRatio));
    //         thisQ.handleElementScale(drag, 'left top');
    //     });
    //
    //     this.getRoot().find('div.droparea svg.dropzones')
    //         .width(this.bgImage().width())
    //         .height(this.bgImage().height());
    //
    //     for (var dropZoneNo = 0; dropZoneNo < this.visibleDropZones.length; dropZoneNo++) {
    //         var dropZone = thisQ.visibleDropZones[dropZoneNo];
    //         var originCoords = dropZone.coords;
    //         var line = thisQ.lines[dropZoneNo];
    //         var lineSVG = thisQ.lineSVGs[dropZoneNo];
    //         line.parse(originCoords, bgRatio);
    //         line.updateSvg(lineSVG);
    //
    //         var handles = line.getHandlePositions();
    //         var markerSpan = this.getRoot().find('div.ddarea div.markertexts span.markertext' + dropZoneNo);
    //         markerSpan
    //             .css('left', handles.moveHandles.x - (markerSpan.outerWidth() / 2) - 4)
    //             .css('top', handles.moveHandles.y - (markerSpan.outerHeight() / 2));
    //         thisQ.handleElementScale(markerSpan, 'center');
    //     }
    // };

    // /**
    //  * Animate a drag item into a given place.
    //  *
    //  * @param {jQuery} drag the item to place.
    //  * @param {boolean} isScaling Scaling or not.
    //  * @param {boolean} initialLoad Whether it is the initial load or not.
    //  */
    // DrawlinesQuestion.prototype.sendDragToDrop = function(drag, isScaling, initialLoad = false) {
    //     var dropArea = this.dropArea(),
    //         bgRatio = this.bgRatio();
    //     drag.removeClass('beingdragged').removeClass('unneeded');
    //     var dragXY = this.convertToBgImgXY(new Line.Point(drag.data('pagex'), drag.data('pagey')));
    //     if (isScaling) {
    //         drag.data('originX', dragXY.x / bgRatio).data('originY', dragXY.y / bgRatio);
    //         drag.css('left', dragXY.x).css('top', dragXY.y);
    //     } else {
    //         drag.data('originX', dragXY.x).data('originY', dragXY.y);
    //         drag.css('left', dragXY.x * bgRatio).css('top', dragXY.y * bgRatio);
    //     }
    //     // We need to save the original scale ratio for each draggable item.
    //     if (!initialLoad) {
    //         // Only set the scale ratio for a current being-dragged item, not for the initial loading.
    //         drag.data('scaleRatio', bgRatio);
    //     }
    //     dropArea.append(drag);
    //     this.handleElementScale(drag, 'left top');
    // };
    //
    // /**
    //  * Scale the drag if needed.
    //  *
    //  * @param {jQuery} element the item to place.
    //  * @param {String} type scaling type
    //  */
    // DrawlinesQuestion.prototype.handleElementScale = function(element, type) {
    //     var bgRatio = parseFloat(this.bgRatio());
    //     if (this.isPrinting) {
    //         bgRatio = 1;
    //     }
    //     $(element).css({
    //         '-webkit-transform': 'scale(' + bgRatio + ')',
    //         '-moz-transform': 'scale(' + bgRatio + ')',
    //         '-ms-transform': 'scale(' + bgRatio + ')',
    //         '-o-transform': 'scale(' + bgRatio + ')',
    //         'transform': 'scale(' + bgRatio + ')',
    //         'transform-origin': type
    //     });
    // };

    // /**
    //  * Sometimes, despite our best efforts, things change in a way that cannot
    //  * be specifically caught (e.g. dock expanding or collapsing in Boost).
    //  * Therefore, we need to periodically check everything is in the right position.
    //  */
    // fixLayoutIfThingsMoved: function() {
    //     if (!questionManager.isKeyboardNavigation) {
    //         this.handleWindowResize(questionManager.isPrinting);
    //     }
    //     // We use setTimeout after finishing work, rather than setInterval,
    //     // in case positioning things is slow. We want 100 ms gap
    //     // between executions, not what setInterval does.
    //     setTimeout(function() {
    //         questionManager.fixLayoutIfThingsMoved(questionManager.isPrinting);
    //     }, 100);
    // },

    /**
     * Get the outer div for this question.
     *
     * @return {*}
     */
    DrawlinesQuestion.prototype.getRoot = function() {
        return document.getElementById(this.containerId);
    };

    /**
     * Get the img that is the background image.
     *
     * @returns {element|undefined} the DOM element (if any)
     */
    DrawlinesQuestion.prototype.bgImage = function() {
        return this.getRoot().querySelector('img.dropbackground');
    };

    /**
     * Returns the coordinates for the line from the SVG.
     * @param {SVGElement} svgEl
     * @returns {Array} the coordinates.
     */
    DrawlinesQuestion.prototype.getSVGLineCoordinates = function(svgEl) {

        var circleStartXCoords = svgEl.childNodes[1].getAttribute('cx');
        var circleStartYCoords = svgEl.childNodes[1].getAttribute('cy');
        var circleStartRCoords = svgEl.childNodes[1].getAttribute('r');
        var circleEndXCoords = svgEl.childNodes[2].getAttribute('cx');
        var circleEndYCoords = svgEl.childNodes[2].getAttribute('cy');
        var circleEndRCoords = svgEl.childNodes[2].getAttribute('r');
        return [circleStartXCoords + ',' + circleStartYCoords + ';' + circleStartRCoords,
            circleEndXCoords + ',' + circleEndYCoords + ';' + circleEndRCoords];
    };

    /**
     * Return the background ratio.
     *
     * @returns {number} Background ratio.
     */
    DrawlinesQuestion.prototype.bgRatio = function() {
        var bgImg = this.bgImage();
        var bgImgNaturalWidth = bgImg.get(0).naturalWidth;
        var bgImgClientWidth = bgImg.width();

        return bgImgClientWidth / bgImgNaturalWidth;
    };

    /**
     * Add this line to an SVG graphic.
     *
     * @param {int} lineNumber Line Number
     * @param {SVGElement} svg the SVG image to which to add this drop zone.
     */
    DrawlinesQuestion.prototype.addToSvg = function(lineNumber, svg) {
        this.lineSVGs[lineNumber] = this.lines[lineNumber].makeSvg(svg);
        if (!this.lineSVGs[lineNumber]) {
            return;
        }
        this.lineSVGs[lineNumber].setAttribute('data-dropzone-no', lineNumber);
        if (svg.getAttribute('class') === 'dropzones') {
            this.lineSVGs[lineNumber].setAttribute('class', 'dropzone choice' + lineNumber + ' placed');
        } else {
            this.lineSVGs[lineNumber].setAttribute('class', 'dropzone choice' + lineNumber + ' inactive');
        }
    };

    /**
     * Update the line of this drop zone in an SVG image.
     *
     * @param {int} dropzoneNo
     */
    DrawlinesQuestion.prototype.updateSvgEl = function(dropzoneNo) {
        this.lines[dropzoneNo].updateSvg(this.lineSVGs[dropzoneNo]);
    };

    /**
     * Start responding to dragging the move handle attached to the line ends (circles).
     *
     * @param {Event} e Event object
     * @param {String} whichHandle which circle handle was moved, i.e., startcircle or endcircle.
     * @param {int} dropzoneNo
     */
    DrawlinesQuestion.prototype.handleCircleMove = function(e, whichHandle, dropzoneNo) {
        var info = dragDrop.prepare(e);
        if (!info.start) {
            return;
        }
        var movingDropZone = this,
            lastX = info.x,
            lastY = info.y,
            dragProxy = this.makeDragProxy(info.x, info.y),
            svg = this.getRoot().querySelector('svg.dropzones'),
            maxX = svg.width.baseVal.value,
            maxY = svg.height.baseVal.value;

        dragDrop.start(e, $(dragProxy), function(pageX, pageY) {
            movingDropZone.lines[dropzoneNo].move(whichHandle,
                parseInt(pageX) - parseInt(lastX), parseInt(pageY) - parseInt(lastY), parseInt(maxX), parseInt(maxY));
            lastX = pageX;
            lastY = pageY;
            movingDropZone.updateSvgEl(dropzoneNo);
            movingDropZone.saveCoordsForChoice(dropzoneNo);
        }, function() {
            document.body.removeChild(dragProxy);
        });
    };

    /**
     * Start responding to dragging the move handle attached to the line.
     *
     * @param {Event} e Event object
     * @param {int} dropzoneNo
     */
    DrawlinesQuestion.prototype.handleLineMove = function(e, dropzoneNo) {
        var info = dragDrop.prepare(e);
        if (!info.start) {
            return;
        }
        var movingDrag = this,
            lastX = info.x,
            lastY = info.y,
            dragProxy = this.makeDragProxy(info.x, info.y),
            maxX,
            maxY,
            whichSVG = "",
            bgImage = this.bgImage(),
            isMoveFromDragsToDropzones,
            isMoveFromDropzonesToDrags,
            svgClass;

        var selectedElement = this.lineSVGs[dropzoneNo];
        const dropX = e.clientX;
        const dropY = e.clientY;

        dragDrop.start(e, $(dragProxy), function(pageX, pageY) {

            // The svg's which are associated with this question.
            var closestSVGs = movingDrag.getSvgsClosestToElement(selectedElement);

            // Check if the drags need to be moved from one svg to another.
            var closeTo = selectedElement.closest('svg');
            svgClass = closeTo.getAttribute('class');

            // Moving the drags between the SVG's.
            // If true, the drag is moved from draghomes SVG to dropZone SVG.
            isMoveFromDragsToDropzones = (svgClass === "dragshome");

            // If true, the drag is moved from dropZone SVG to draghomes SVG.
            isMoveFromDropzonesToDrags = (svgClass === 'dropzones') &&
                (movingDrag.lines[dropzoneNo].centre1.y > (bgImage.height - 20));

            if (isMoveFromDragsToDropzones || isMoveFromDropzonesToDrags) {
                movingDrag.lines[dropzoneNo].addToDropZone('mouse', selectedElement,
                    closestSVGs.svgDropZone, closestSVGs.svgDragsHome, dropX, dropY);
            }

            // Drag the lines within the SVG
            // Get the dimensions of the selected element's svg.
            closeTo = selectedElement.closest('svg');
            var dimensions = movingDrag.getSvgDimensionsByClass(closeTo, closeTo.getAttribute('class'));
            maxX = dimensions.maxX;
            maxY = dimensions.maxY;
            whichSVG = dimensions.whichSVG;

            movingDrag.lines[dropzoneNo].moveDrags(
                parseInt(pageX) - parseInt(lastX), parseInt(pageY) - parseInt(lastY),
                parseInt(maxX), parseInt(maxY), whichSVG);
            lastX = pageX;
            lastY = pageY;

            movingDrag.updateSvgEl(dropzoneNo);
            movingDrag.saveCoordsForChoice(dropzoneNo);
        }, function() {
            document.body.removeChild(dragProxy);
        });
    };

    /**
     * Make an invisible drag proxy.
     *
     * @param {int} x x position .
     * @param {int} y y position.
     * @returns {HTMLElement} the drag proxy.
     */
    DrawlinesQuestion.prototype.makeDragProxy = function(x, y) {
        var dragProxy = document.createElement('div');
        dragProxy.style.position = 'absolute';
        dragProxy.style.top = y + 'px';
        dragProxy.style.left = x + 'px';
        dragProxy.style.width = '1px';
        dragProxy.style.height = '1px';
        document.body.appendChild(dragProxy);
        return dragProxy;
    };

    /**
     * Save the coordinates for a dropped item in the form field.
     *
     * @param {Number} choiceNo which copy of the choice this was.
     **/
    DrawlinesQuestion.prototype.saveCoordsForChoice = function(choiceNo) {
        let imageCoords = [];
        var items = this.getRoot().querySelector('svg g.choice' + choiceNo),
            gEleClassAttributes = '';
        if (items) {
                imageCoords = items.querySelector('polyline').getAttribute('points');
                gEleClassAttributes = items.getAttribute('class');
                // TODO: Kept the below comment as this could be needed for window resizing.

                // thiQ = this,
                // bgRatio = this.bgRatio();
                //     if (drag.data('scaleRatio') !== bgRatio) {
                //         // The scale ratio for the draggable item was changed. We need to update that.
                //         drag.data('pagex', drag.offset().left).data('pagey', drag.offset().top);
                //     }
                //     var dragXY = new Line.Point(drag.data('pagex'), drag.data('pagey'));
                //     window.console.log("dragXY:" + dragXY);
                //
                //     window.console.log("thiQ:" + thiQ);
                //     if (thiQ.coordsInBgImg(dragXY)) {
                //         var bgImgXY = thiQ.convertToBgImgXY(dragXY);
                //         bgImgXY = new Line.Point(bgImgXY.x / bgRatio, bgImgXY.y / bgRatio);
                //         imageCoords[imageCoords.length] = bgImgXY;
                //         window.console.log("bgImgXY:" + bgImgXY);
                //     }
                // } else if (drag.data('imageCoords')) {
                //     imageCoords[imageCoords.length] = drag.data('imageCoords');
                // }

        }
        if (gEleClassAttributes !== '' && gEleClassAttributes.includes('placed')) {
            this.getRoot().querySelector('input.choice' + choiceNo).value = imageCoords;
        } else if (gEleClassAttributes !== '' && gEleClassAttributes.includes('inactive')) {
            this.getRoot().querySelector('input.choice' + choiceNo).value = '';
        }
    };

    /**
     * Handle key down / press events on svg lines.
     *
     * @param {KeyboardEvent} e
     * @param {SVGElement} drag SVG element being dragged.
     * @param {int} dropzoneNo
     * @param {String} activeElement The element being dragged, whether it is the line or the line endpoints.
     */
    DrawlinesQuestion.prototype.handleKeyPress = function(e, drag, dropzoneNo, activeElement) {

        var x = 0,
            y = 0,
            dropzoneElement,
            question = questionManager.getQuestionForEvent(e);

        dropzoneElement = drag.closest('g');
        switch (e.code) {
            case 'ArrowLeft':
            case 'KeyA': // A.
                x = -1;
                break;
            case 'ArrowRight':
            case 'KeyD': // D.
                x = 1;
                break;
            case 'ArrowDown':
            case 'KeyS': // S.
                y = 1;
                break;
            case 'ArrowUp':
            case 'KeyW': // W.
                y = -1;
                break;
            case 'Space':
            case 'Escape':
                break;
            default:
                return; // Ingore other keys.
        }
        e.preventDefault();

        // Moving the drags between the SVG's.
        var closeTo = drag.closest('svg');
        var svgClass = closeTo.getAttribute('class');
        var maxX,
            maxY,
            whichSVG;
        var bgImage = this.bgImage();
        var closestSVGs = this.getSvgsClosestToElement(drag);
        var isMoveFromDragsToDropzones = (svgClass === "dragshome");
        var isMoveFromDropzonesToDrags = (svgClass === 'dropzones') &&
            (question.lines[dropzoneNo].centre1.y > (bgImage.height - 20));

        if (isMoveFromDragsToDropzones) {
            question.lines[dropzoneNo].addToDropZone('keyboard', dropzoneElement,
                closestSVGs.svgDropZone, closestSVGs.svgDragsHome, null, null, 'DragsSVG');
        } else if (isMoveFromDropzonesToDrags) {
            question.lines[dropzoneNo].addToDropZone('keyboard', dropzoneElement,
                closestSVGs.svgDropZone, closestSVGs.svgDragsHome, null, null, 'DropZonesSVG');
        }

        // Get the dimensions of the selected element's svg.
        closeTo = drag.closest('svg');
        var dimensions = question.getSvgDimensionsByClass(closeTo, closeTo.getAttribute('class'));
        maxX = dimensions.maxX;
        maxY = dimensions.maxY;
        whichSVG = dimensions.whichSVG;

        if (activeElement === 'line') {
            // Move the entire line when the focus is on it.
            question.lines[dropzoneNo].moveDrags(parseInt(x), parseInt(y), parseInt(maxX), parseInt(maxY), whichSVG);
        } else {
            // Move the line endpoints.
            question.lines[dropzoneNo].move(activeElement, parseInt(x), parseInt(y), parseInt(maxX), parseInt(maxY));
        }
        question.updateSvgEl(dropzoneNo);
        this.saveCoordsForChoice(dropzoneNo);
        drag.focus();
    };

    /**
     * Returns the dimensions of the SVG image to which the drag element belongs.
     *
     * @param {SVG} dragSVG The SVG to which the drag element belongs.
     * @param {String} className Class asscociated with the SVG
     * @return {{whichSVG: (string), maxY: number, maxX: number}}
     */
    DrawlinesQuestion.prototype.getSvgDimensionsByClass = function(dragSVG, className) {
        return {
            maxX: dragSVG.width.baseVal.value,
            maxY: dragSVG.height.baseVal.value,
            whichSVG: className === 'dragshome' ? 'DragsSVG' : 'DropZonesSVG'
        };
    };

    /**
     * Returns the SVG's to which the drag element belongs.
     *
     * @param {SVGElement} dragElement The element which is being moved.
     * @return {{svgDragsHome, svgDropZone}}
     */
    DrawlinesQuestion.prototype.getSvgsClosestToElement = function(dragElement) {
        var svgElement = dragElement.closest('svg');
        var svgElementClass = svgElement.getAttribute('class');
        var svgDragsHome, svgDropZone, parent;

        if (svgElementClass === "dragshome") {
            svgDragsHome = svgElement;
            parent = svgElement.closest('.ddarea');
            svgDropZone = parent.querySelector('.dropzones');
        } else {
            svgDropZone = svgElement;
            parent = svgElement.closest('.ddarea');
            svgDragsHome = parent.querySelector('.dragshome');
        }
        return {
            svgDropZone: svgDropZone,
            svgDragsHome: svgDragsHome
        };
    };

    /**
     * Loading SVG image.
     *
     * @param {HTMLImageElement}  img
     */
    DrawlinesQuestion.prototype.createSvgOnImageLoad = function(img) {
        if (!img) {
            window.console.error(`Image with id '${img}' not found.`);
            return;
        }

        // Check if the image is already loaded
        if (img.complete && img.naturalHeight !== 0) {
            this.drawDropzone();
        } else {
            // Add an event listener for the load event
            img.addEventListener('load', () => this.drawDropzone());
        }
    };

    /**
     * Singleton that tracks all the DrawlinesQuestions on this page, and deals
     * with event dispatching.
     *
     * @type {Object}
     */
    var questionManager = {

        /**
         * {boolean} ensures that the event handlers are only initialised once per page.
         */
        eventHandlersInitialised: false,

        /**
         * {Object} ensures that the marker event handlers are only initialised once per question,
         * indexed by containerId (id on the .que div).
         */
        lineEventHandlersInitialised: {},

        /**
         * {boolean} is printing or not.
         */
        isPrinting: false,

        /**
         * {boolean} is keyboard navigation.
         */
        isKeyboardNavigation: false,

        /**
         * {Object} all the questions on this page, indexed by containerId (id on the .que div).
         */
        questions: {}, // An object containing all the information about each question on the page.

        /**
         * @var {int} the number of lines on the form.
         */
        noOfLines: null,

        /**
         * @var {DrawlinesQuestion[]} the lines in the preview, indexed by line number.
         */
        dropZones: [],

        /**
         * @var {line[]} the question lines in the preview, indexed by line number.
         */
        questionLines: [],

        /**
         * Initialise one question.
         *
         * @param {String} containerId the id of the div.que that contains this question.
         * @param {boolean} readOnly whether the question is read-only.
         * @param {Object[]} visibleDropZones data on any drop zones to draw as part of the feedback.
         * @param {Object[]} questionLines
         */
        init: function(containerId, readOnly, visibleDropZones, questionLines) {
            questionManager.questions[containerId] =
                new DrawlinesQuestion(containerId, readOnly, visibleDropZones, questionLines);

            questionManager.questions[containerId].updateCoordinates();

            if (!questionManager.lineEventHandlersInitialised.hasOwnProperty(containerId)) {
                questionManager.lineEventHandlersInitialised[containerId] = true;

                var questionContainer = document.getElementById(containerId);
                if (questionContainer.classList.contains('drawlines') &&
                    !questionContainer.classList.contains('qtype_drawlines-readonly')) {

                    // Add event listeners to the 'previewArea'.
                    // For dropzone SVG.
                    var dropArea = questionContainer.querySelector('.droparea');
                    // Add event listener for mousedown and touchstart events.
                    dropArea.addEventListener('mousedown', questionManager.handleDropZoneEventMove);
                    dropArea.addEventListener('touchstart', questionManager.handleDropZoneEventMove);
                    // Add event listener for keydown and keypress events.
                    dropArea.addEventListener('keydown', questionManager.handleKeyPress);
                    dropArea.addEventListener('keypress', questionManager.handleKeyPress);

                    // For draghomes SVG.
                    var drags = questionContainer.querySelector('.draghomes');
                    // Add event listener for mousedown and touchstart events.
                    drags.addEventListener('mousedown', questionManager.handleDragHomeEventMove);
                    drags.addEventListener('touchstart', questionManager.handleDragHomeEventMove);
                    // Add event listener for keydown and keypress events.
                    drags.addEventListener('keydown', questionManager.handleKeyPress);
                    drags.addEventListener('keypress', questionManager.handleKeyPress);
                }
            }
        },

        // TODO: commented as currently we are not using this function. To be removed later if not needed.
        // /**
        //  * Set up the event handlers that make this question type work. (Done once per page.)
        //  */
        // setupEventHandlers: function() {
        //     $(window).on('resize', function() {
        //         questionManager.handleWindowResize(false);
        //     });
        //     window.addEventListener('beforeprint', function() {
        //         questionManager.isPrinting = true;
        //         questionManager.handleWindowResize(questionManager.isPrinting);
        //     });
        //     window.addEventListener('afterprint', function() {
        //         questionManager.isPrinting = false;
        //         questionManager.handleWindowResize(questionManager.isPrinting);
        //     });
        //     setTimeout(function() {
        //         questionManager.fixLayoutIfThingsMoved();
        //     }, 100);
        // },

        /**
         * Handle mouse and touch events for dropzone svg.
         *
         * @param {Event} event
         */
        handleDropZoneEventMove: function(event) {
            var dropzoneElement, dropzoneNo;
            var question = questionManager.getQuestionForEvent(event);
            if (event.target.closest('.dropzone .startcircle.shape')) {
                // Dragging the move handle circle attached to the start of the line.
                dropzoneElement = event.target.closest('g');
                dropzoneNo = dropzoneElement.dataset.dropzoneNo;
                question.handleCircleMove(event, 'startcircle', dropzoneNo);
            } else if (event.target.closest('.dropzone .endcircle.shape')) {
                // Dragging the move handle circle attached to the end of the line.
                dropzoneElement = event.target.closest('g');
                dropzoneNo = dropzoneElement.dataset.dropzoneNo;
                question.handleCircleMove(event, 'endcircle', dropzoneNo);
            } else if (event.target.closest('polyline.shape')) {
                // Dragging the entire line.
                dropzoneElement = event.target.closest('g');
                dropzoneNo = dropzoneElement.dataset.dropzoneNo;
                question.handleLineMove(event, dropzoneNo);
            }
        },

        /**
         * Handle mouse and touch events for dragshome svg.
         *
         * @param {Event} event
         */
        handleDragHomeEventMove: function(event) {
            var dropzoneElement, dropzoneNo;
            var question = questionManager.getQuestionForEvent(event);
            if (event.target.closest('g')) {
                dropzoneElement = event.target.closest('g');
                dropzoneNo = dropzoneElement.dataset.dropzoneNo;
                question.handleLineMove(event, dropzoneNo);
                question.saveCoordsForChoice(dropzoneNo);
            }
        },

        /**
         * Handle key down / press events on markers.
         *
         * @param {Event} e
         */
        handleKeyPress: function(e) {
            var question = questionManager.getQuestionForEvent(e);
            var dropzoneElement, dropzoneNo, drag, activeElement;
            if (e.target.closest('.dropzone circle.startcircle')) {
                dropzoneElement = e.target.closest('.dropzone');
                dropzoneNo = dropzoneElement.dataset.dropzoneNo;
                drag = e.target.closest('.dropzone circle.startcircle');
                activeElement = 'startcircle';
            } else if (e.target.closest('.dropzone circle.endcircle')) {
                drag = e.target.closest('.dropzone circle.endcircle');
                dropzoneElement = e.target.closest('.dropzone');
                dropzoneNo = dropzoneElement.dataset.dropzoneNo;
                activeElement = 'endcircle';
            } else if (e.target.closest('g.dropzone')) {
                drag = e.target.closest('g.dropzone');
                dropzoneElement = e.target.closest('.dropzone');
                dropzoneNo = dropzoneElement.dataset.dropzoneNo;
                activeElement = 'line';
            }
            if (question && dropzoneElement) {
                question.handleKeyPress(e, drag, dropzoneNo, activeElement);
            }
        },

        /**
         * Handle when the window is resized.
         *
         * @param {boolean} isPrinting
         */
        handleWindowResize: function(isPrinting) {
            for (var containerId in questionManager.questions) {
                if (questionManager.questions.hasOwnProperty(containerId)) {
                    questionManager.questions[containerId].isPrinting = isPrinting;
                    questionManager.questions[containerId].handleResize();
                }
            }
        },

        /**
         * Given an event, work out which question it effects.
         *
         * @param {Event} e the event.
         * @returns {DrawlinesQuestion|undefined} The question, or undefined.
         */
        getQuestionForEvent: function(e) {
            var containerId = $(e.currentTarget).closest('.que.drawlines').attr('id');
            return questionManager.questions[containerId];
        },
    };

    /**
     * @alias module:qtype_drawlines/question
     */
    return {
        /**
         * Initialise one drag-drop markers question.
         *
         * @param {String} containerId id of the outer div for this question.
         * @param {boolean} readOnly whether the question is being displayed read-only.
         * @param {String[]} visibleDropZones the geometry of any drop-zones to show.
         * @param {Object[]} questionLines
         */
        init: questionManager.init,
    };
});
