/**
 * nativesortable
 *
 * Originally based on code found here:
 * http://www.html5rocks.com/en/tutorials/dnd/basics/#toc-examples
 *
 * @example
 * var list = document.getElementByID('list');
 * nativesortable(list, { change: onchange });
 *
 * @author Brian Grinstead
 * @license MIT License
 */
(function(definition) {
    if (typeof exports === 'object') {
        module.exports = definition();
    } else if (typeof define === 'function' && define.amd) {
        define([], definition);
    } else {
        window.nativesortable = definition();
    }
})(function() {
    var supportsTouch = ('ontouchstart' in window) || (window.DocumentTouch && document instanceof DocumentTouch);
    var supportsDragAndDrop = !supportsTouch && (function() {
        var div = document.createElement('div');
        return ('draggable' in div) || ('ondragstart' in div && 'ondrop' in div);
    })();

    var CHILD_CLASS = 'sortable-child';
    var DRAGGING_CLASS = 'sortable-dragging';
    var OVER_CLASS = 'sortable-over';

    function moveElementNextTo(element, elementToMoveNextTo) {
        if (isBelow(element, elementToMoveNextTo)) {
            // Insert element before to elementToMoveNextTo.
            elementToMoveNextTo.parentNode.insertBefore(element, elementToMoveNextTo);
        } else {
            // Insert element after to elementToMoveNextTo.
            elementToMoveNextTo.parentNode.insertBefore(element, elementToMoveNextTo.nextSibling);
        }
    }

    function isBelow(el1, el2) {
        var parent = el1.parentNode;
        if (el2.parentNode !== parent) {
            return false;
        }

        var cur = el1.previousSibling;
        while (cur && cur.nodeType !== 9) {
            if (cur === el2) {
                return true;
            }
            cur = cur.previousSibling;
        }
        return false;
    }

    function moveUpToChildNode(parent, child) {
        var cur = child;
        if (cur === parent) {
            return null;
        }

        while (cur) {
            if (cur.parentNode === parent) {
                return cur;
            }

            cur = cur.parentNode;
            if ( !cur || !cur.ownerDocument || cur.nodeType === 11 ) {
                break;
            }
        }
        return null;
    }

    function prevent(e) {
        if (e.stopPropagation) {
            e.stopPropagation();
        }
        if (e.preventDefault) {
            e.preventDefault();
        }
        e.returnValue = false;
    }

    function dragenterData(element, val) {
        if (arguments.length === 1) {
            return parseInt(element.dataset.childDragenter, 10) || 0;
        }
        if (!val) {
            delete element.dataset.childDragenter;
        } else {
            element.dataset.childDragenter = Math.max(0, val);
        }
    }

    return function(element, opts) {
        opts = opts || {};
        var warp = !!opts.warp;
        var stop = opts.stop || function() { };
        var start = opts.start || function() { };
        var change = opts.change || function() { };
        var currentlyDraggingElement = null;
        var currentlyDraggingTarget = null;

        var handleDragStart = delegate(function(e) {
            if (supportsTouch) {
                prevent(e);
            }
            if (e.dataTransfer) {
                e.dataTransfer.effectAllowed = 'moving';
                e.dataTransfer.setData('Text', '*'); // Need to set to something or else drag doesn't start
            }

            currentlyDraggingElement = this;
            currentlyDraggingElement.classList.add(DRAGGING_CLASS);

            [].forEach.call(element.childNodes, function(el) {
                if (el.nodeType === 1) {
                    el.classList.add(CHILD_CLASS);
                }
            });
            addFakeDragHandlers();
        });

        var handleDragOver = delegate(function(e) {
            if (!currentlyDraggingElement) {
                return true;
            }
            if (e.preventDefault) {
                e.preventDefault();
            }
            return false;
        });

        var handleDragEnter = delegate(function() {
            if (!currentlyDraggingElement || currentlyDraggingElement === this) {
                return true;
            }

            // Prevent dragenter on a child from allowing a dragleave on the container
            var previousCounter = dragenterData(this);
            dragenterData(this, previousCounter + 1);

            if (previousCounter === 0) {
                this.classList.add(OVER_CLASS);
                if (!warp) {
                    moveElementNextTo(currentlyDraggingElement, this);
                }
            }
            return false;
        });

        var handleDragLeave = delegate(function() {
            // Prevent dragenter on a child from allowing a dragleave on the container
            var previousCounter = dragenterData(this);
            dragenterData(this, previousCounter - 1);

            // This is a fix for child elements firing dragenter before the parent fires dragleave
            if (!dragenterData(this)) {
                this.classList.remove(OVER_CLASS);
                dragenterData(this, false);
            }
        });

        var handleDrop = delegate(function(e) {
            if (e.type === 'drop') {
                if (e.stopPropagation) {
                    e.stopPropagation();
                }
                if (e.preventDefault) {
                    e.preventDefault();
                }
            }
            if (this === currentlyDraggingElement) {
                return;
            }
            if (warp) {
                var thisSibling = currentlyDraggingElement.nextSibling;
                this.parentNode.insertBefore(currentlyDraggingElement, this);
                this.parentNode.insertBefore(this, thisSibling);
            }
            change(this, currentlyDraggingElement);
        });

        var handleDragEnd = function() {
            currentlyDraggingElement = null;
            currentlyDraggingTarget = null;
            [].forEach.call(element.childNodes, function(el) {
                if (el.nodeType === 1) {
                    el.classList.remove(OVER_CLASS, DRAGGING_CLASS, CHILD_CLASS);
                    dragenterData(el, false);
                }
            });
            removeFakeDragHandlers();
        };

        var handleTouchMove = delegate(function(e) {
            if (!currentlyDraggingElement ||
                currentlyDraggingElement === this ||
                currentlyDraggingTarget === this) {
                return true;
            }

            [].forEach.call(element.childNodes, function(el) {
                el.classList.remove(OVER_CLASS);
            });

            currentlyDraggingTarget = this;

            if (!warp) {
                moveElementNextTo(currentlyDraggingElement, this);
            } else {
                this.classList.add(OVER_CLASS);
            }
            return prevent(e);
        });

        function delegate(fn) {
            return function(e) {
                var touch = (supportsTouch && e.touches && e.touches[0]) || { };
                var target = touch.target || e.target;

                // Fix event.target for a touch event
                if (supportsTouch && document.elementFromPoint) {
                    target = document.elementFromPoint(e.pageX - document.body.scrollLeft, e.pageY - document.body.scrollTop);
                }

                if (target.classList && target.classList.contains(CHILD_CLASS)) {
                    fn.apply(target, [e]);
                } else if (target !== element) {
                    // If a child is initiating the event or ending it, then use the container as context for the callback.
                    var context = moveUpToChildNode(element, target);
                    if (context) {
                        fn.apply(context, [e]);
                    }
                }
            };
        }

        // Opera and mobile devices do not support drag and drop.  http://caniuse.com/dragndrop
        // Bind/unbind standard mouse/touch events as a polyfill.
        function addFakeDragHandlers() {
            if (!supportsDragAndDrop) {
                if (supportsTouch) {
                    element.addEventListener('touchmove', handleTouchMove);
                } else {
                    element.addEventListener('mouseover', handleDragEnter);
                    element.addEventListener('mouseout', handleDragLeave);
                }

                element.addEventListener(supportsTouch ? 'touchend' : 'mouseup', handleDrop);
                document.addEventListener(supportsTouch ? 'touchend' : 'mouseup', handleDragEnd);
                document.addEventListener('selectstart', prevent);
            }
        }

        function removeFakeDragHandlers() {
            if (!supportsDragAndDrop) {
                if (supportsTouch) {
                    element.removeEventListener('touchmove', handleTouchMove);
                } else {
                    element.removeEventListener('mouseover', handleDragEnter);
                    element.removeEventListener('mouseout', handleDragLeave);
                }

                element.removeEventListener(supportsTouch ? 'touchend' : 'mouseup', handleDrop);
                document.removeEventListener(supportsTouch ? 'touchend' : 'mouseup', handleDragEnd);
                document.removeEventListener('selectstart', prevent);
            }
        }

        if (supportsDragAndDrop) {
            element.addEventListener('dragstart', handleDragStart);
            element.addEventListener('dragenter', handleDragEnter);
            element.addEventListener('dragleave', handleDragLeave);
            element.addEventListener('drop', handleDrop);
            element.addEventListener('dragover', handleDragOver);
            element.addEventListener('dragend', handleDragEnd);
        } else if (supportsTouch) {
            element.addEventListener('touchstart', handleDragStart);
        } else {
             element.addEventListener('mousedown', handleDragStart);
        }

        [].forEach.call(element.childNodes, function(el) {
            if (el.nodeType === 1) {
                el.setAttribute('draggable', 'true');
            }
        });
    };
});
