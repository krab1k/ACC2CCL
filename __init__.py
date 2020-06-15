from flask import Flask


application = Flask(__name__)

application.jinja_env.trim_blocks = True
application.jinja_env.lstrip_blocks = True

EXAMPLES_DIR = '/home/krab1k/Research/CCL/examples'
CHARGEFW2_DIR = '/opt/chargefw2'


if __name__ == '__main__':
    application.run()

from . import routes
