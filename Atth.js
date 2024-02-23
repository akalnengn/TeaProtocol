const fs = require('fs');
const util = require('util');
const exec = util.promisify(require('child_process').exec);

class Atth {
    constructor() {
        this.pci = new PCI();
        this.modules = new Modules();
    }
}

function readFromFile(path, file) {
    try {
        if (fs.existsSync(`${path}/${file}`)) {
            return fs.readFileSync(`${path}/${file}`, 'utf8').replace("0x", "").trim();
        } else {
            return "";
        }
    } catch (error) {
        console.error(error);
        return "";
    }
}

class Device {
    constructor(path) {
        this.path = path;
        this.vendor = readFromFile(path, "vendor");
        this.device = readFromFile(path, "device");
        this.subdevice = `${readFromFile(path, "subsystem_vendor")}:${readFromFile(path, "subsystem_device")}`;
    }
}

class PCI {
    constructor() {
        this.path = "/sys/bus/pci/devices/0*";
        this.devices = {};
        this.inspect();
    }

    inspect() {
        const devPaths = fs.readdirSync(this.path);
        devPaths.forEach(dp => {
            this.devices[dp] = new Device(`${this.path}/${dp}`);
        });
    }
}

class Module {
    constructor(line) {
        const parse = line.split(/\s+/);
        this.name = parse[0];
        this.size = parseInt(parse[1], 10);
        this.usedBy = parseInt(parse[2], 10);
        this.uses = parse.slice(3);

        console.log(this.name);
        this.uses.forEach(u => {
            console.log("  ", u);
        });
    }
}

class Modules {
    constructor() {
        this.modules = {};
        this.inspect();
    }

    async inspect() {
        try {
            const { stdout } = await exec("lsmod");
            const out = stdout.split('\n');
            out.slice(1).forEach(l => {
                const name = l.split(/\s+/)[0];
                this.modules[name] = new Module(l);
            });
        } catch (error) {
            console.error(error);
        }
    }
}

module.exports = Atth;
