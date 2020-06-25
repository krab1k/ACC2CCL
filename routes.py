from flask import request, render_template, send_from_directory, redirect, url_for, flash
import os
from ccl.translate import translate
from ccl.errors import CCLCodeError
import tempfile
import subprocess
import uuid

from .files import prepare_file


from . import application, EXAMPLES_DIR, CHARGEFW2_DIR

computations = {}


def get_examples():
    return [os.path.splitext(file)[0] for file in os.listdir(EXAMPLES_DIR)]


@application.route('/get-example', methods=['POST'])
def get_example():
    method = request.data.strip().decode('UTF-8')
    try:
        with open(os.path.join(EXAMPLES_DIR, f'{method}.ccl')) as f:
            source = f.read()
    except IOError:
        return {'status': 'failed', 'errorMessage': 'Incorrect example'}

    return {'status': 'ok', 'source': source}


@application.route('/')
def index():
    return render_template('index.html', methods=get_examples())


@application.route('/check-code', methods=['POST'])
def check():
    code = request.data.strip().decode('utf-8') + '\n'
    try:
        translate(code, 'latex')
        return {'status': 'ok'}
    except CCLCodeError as e:
        return {'status': 'failed', 'lineNumber': e.line, 'errorMessage': e.message}


@application.route('/generate-pdf', methods=['POST'])
def generate_pdf():
    code = request.data.strip().decode('utf-8') + '\n'
    try:
        output = translate(code, 'latex', full_output=True)
    except CCLCodeError as e:
        return {'status': 'failed', 'errorMessage': f'Code check failed: {e.message}'}

    with tempfile.TemporaryDirectory() as tmpdir:
        tex_file = os.path.join(tmpdir, 'method.tex')
        with open(tex_file, 'w') as f:
            f.write(output)

        p = subprocess.run(['xelatex', tex_file], stderr=subprocess.PIPE, cwd=tmpdir)
        if p.returncode:
            print(p.stderr)
            return {'status': 'failed', 'errorMessage': f'LaTeX compilation failed'}

        return send_from_directory(tmpdir, 'method.pdf', mimetype='application/pdf', cache_timeout=0,
                                   as_attachment=True)


@application.route('/compile', methods=['POST'])
def compile_method():
    code = request.form['code'] + '\n'

    comp_id = str(uuid.uuid1())
    tmpdir = tempfile.mkdtemp()

    computations[comp_id] = {'dir': tmpdir}
    try:
        translate(code, 'cpp', output_dir=tmpdir)
    except CCLCodeError as e:
        return {'status': 'failed', 'errorMessage': f'Code check failed: {e.message}'}

    args = ['cmake', '.', f'-DCHARGEFW2_DIR={CHARGEFW2_DIR}']
    p = subprocess.run(args, cwd=tmpdir, stderr=subprocess.PIPE)
    if p.returncode:
        print(p.stderr)
        return {'status': 'failed', 'errorMessage': 'Initialization failed'}

    p = subprocess.run(['make'], cwd=tmpdir, stderr=subprocess.PIPE)
    if p.returncode:
        print(p.stderr)
        return {'status': 'failed', 'errorMessage': 'Compilation failed'}

    # p = subprocess.run(['/opt/chargefw2/bin/chargefw2', '--mode', 'info', '--input-file',
    #                     '/home/krab1k/krab1k/Research/test_data/water.sdf'], cwd=tmpdir, stderr=subprocess.PIPE)
    # if p.returncode:
    #    print(p.stderr)
    #    return {'status': 'failed', 'errorMessage': 'Calculation failed'}
    return redirect(url_for('get_input', r=comp_id))


@application.route('/input', methods=['GET', 'POST'])
def get_input():
    if request.method == 'POST':
        tmp_dir = tempfile.mkdtemp(prefix='compute_')
        os.mkdir(os.path.join(tmp_dir, 'input'))
        os.mkdir(os.path.join(tmp_dir, 'output'))
        os.mkdir(os.path.join(tmp_dir, 'logs'))

        if request.form['input-type'] == 'user-input':
            if not prepare_file(request, tmp_dir):
                flash('Invalid file provided. Supported types are common chemical formats: sdf, mol2, pdb, cif'
                      ' and zip or tar.gz of those.', 'error')
                return render_template('index.html')
        print(request.form)
        print(request.files)

    return render_template('input.html')
