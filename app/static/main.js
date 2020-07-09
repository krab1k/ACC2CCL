'use strict';

const spinner = '<span class="spinner-border spinner-border-sm" role="status" ' +
                  'aria-hidden="true" style="animation-duration: 1.5s"></span>';


function check_code(editor) {
    $.ajax({
        type: 'POST',
        url: '/check-code',
        data: editor.getValue(),
        contentType: 'application/json;charset=UTF-8',
        success: function (result) {
            const status = result['status'];
            if (check_code.mark !== null) {
                check_code.mark.clear();
            }
            if (status === 'ok') {
                $('#output').text('OK');
                $('#generate_pdf').attr('disabled', false);
                $('#compile').attr('disabled', false);
            } else if (status === 'failed') {
                $('#generate_pdf').attr('disabled', true);
                $('#compile').attr('disabled', true);
                const lineNumber = result['lineNumber'] - 1;
                const lastChar = editor.getLine(lineNumber).length;
                check_code.mark = editor.markText({line: lineNumber, ch: 0}, {
                    line: lineNumber,
                    ch: lastChar
                }, {css: 'background-color: red'});
                $('#output').text(result['errorMessage']);
            } else {
                console.error('Incorrect response returned.');
            }
        }
    });
}

check_code.mark = null;


function throttle(func, milliseconds) {
    let lastCall = 0;
    return function () {
        let now = Date.now();
        if (lastCall + milliseconds < now) {
            lastCall = now;
            return func.apply(this, arguments);
        }
    };
}

const default_ccl_code = 'name zero\nq = 0'


function init_index() {
    let editor = CodeMirror.fromTextArea(document.getElementById('code'), {
        'lineNumbers': true,
    });

    editor.setValue(default_ccl_code);

    editor.on('change', throttle(function () {
        check_code(editor);
        $("#methods").prop('selectedIndex', '0');
    }, 10));

    let $output = $('#output');

    let $generate_pdf = $('#generate_pdf');
    $generate_pdf.on('click', function () {
        $generate_pdf.attr('disabled', true);

        let req = new XMLHttpRequest();
        req.open('POST', '/generate-pdf', true);
        req.responseType = 'arraybuffer';
        req.onload = function () {
            /* Recover json from arraybuffer on error */
            if (req.getResponseHeader('content-type') === 'application/json') {
                const decodedString = String.fromCharCode.apply(null, new Uint8Array(req.response));
                const req_json = JSON.parse(decodedString);
                $output.text(req_json['errorMessage']);
                return;
            }
            let arrayBuffer = req.response;
            $generate_pdf.attr('disabled', false);

            let blob = new Blob([arrayBuffer], {type:  'application/pdf'});
            let a = document.createElement('a');
            a.href = window.URL.createObjectURL(blob);
            a.download = 'method.pdf';
            document.body.append(a);
            a.click();
            document.body.removeChild(a);
        };
        req.send(editor.getValue());
    });

    let $methods = $('#methods');
    $methods.on('change', function () {
        const method = $methods.val();
        if (method === '') {
            return;
        }
        $.ajax({
            url: 'get-example',
            data: method,
            type: 'POST',
            contentType: 'text/plain;charset=UTF-8',
            success: function (result) {
                if (result['status'] === 'ok') {
                    editor.setValue(result['source']);
                } else {
                    editor.setValue('');
                    $output.text(result['errorMessage']);
                }
            }
        })
    })

    let $compile = $('#compile');
    $compile.on('click', function (e) {
        $compile.html(`${spinner} Compiling...`);
        $('form').submit();
    })
}


function disable_buttons() {
    const $buttons = $('.btn');
    $buttons.each(function () {
        $(this).prop('disabled', true);
    });
}


function init_input() {
     /* Allow submit only if file is selected */
    const $input = $('#file_input');
    const $charges = $('#charges');
    const $examples = $('button[name^="example"]');

    $charges.prop('disabled', true);

    $input.on('change', function () {
        if ($input.val()) {
            $charges.prop('disabled', false);
        } else {
            $charges.prop('disabled', true);
        }
    });

    $examples.on('click', function () {
        disable_buttons();
        $(this).html(`${spinner} Computing...`);
        $('#example-name').val($(this).prop('name'));
        $('form').submit();
    });

    $charges.on('click', function (e) {
        if ($input[0].files[0].size > 10 * 1024 * 1024) {
            alert('Cannot upload file larger than 10 MB');
            e.preventDefault();
        } else {
            disable_buttons();
            $charges.html(`${spinner} Computing...`);
            $('#type').val('charges');
            $('form').submit();
        }
    });

    /* Fix disabled buttons when user press Back button in browser (at least in Chrome) */
    $input.trigger('change');
}


$(function () {
    let page = window.location.pathname;
    if (page === '/') {
        init_index();
    } else if (page === '/input') {
        init_input();
    }
});
