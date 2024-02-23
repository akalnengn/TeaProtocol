const fs = require('fs');
const https = require('https');
const util = require('util');
const exec = util.promisify(require('child_process').exec);

class PCIIds {
    constructor(url = 'https://pci-ids.ucw.cz') {
        this.url = url;
        this.version = '';
        this.date = '';
        this.compressed = 'pci.ids.bz2';
        this.vendors = {};
        this.contents = null;
        this.loadLocal();
        this.parse();
    }

    reportVendors() {
        for (const [vid, v] of Object.entries(this.vendors)) {
            console.log(`${v.ID} ${v.name}`);
        }
    }

    report(vendor = null) {
        if (vendor !== null) {
            if (vendor in this.vendors) {
                this.vendors[vendor].report();
            }
        } else {
            for (const [vID, v] of Object.entries(this.vendors)) {
                v.report();
            }
        }
    }

    findDate(content) {
        for (const line of content) {
            if (line.includes('Date:')) {
                return line.split(/\s+/).reverse()[1].replace('-', '');
            }
        }
        return null;
    }

    parse() {
        if (this.contents.length < 1) {
            console.log(`data/${this.date}-pci.ids not found`);
        } else {
            let vendorID = '';
            let deviceID = '';
            for (const line of this.contents) {
                if (line[0] === '#') {
                    continue;
                } else if (line.trim().length === 0) {
                    continue;
                } else {
                    if (line.indexOf('\t\t') === 0) {
                        this.vendors[vendorID].devices[deviceID].addSubDevice(line);
                    } else if (line.indexOf('\t') === 0) {
                        deviceID = line.trim().split(' ')[0];
                        this.vendors[vendorID].addDevice(line);
                    } else {
                        vendorID = line.split(' ')[0];
                        this.vendors[vendorID] = new Vendor(line);
                    }
                }
            }
        }
    }

    getLatest() {
        const [ver, date, url] = this.latestVersion();
        const outfile = `data/${date}-${this.compressed.slice(0, -4)}`;
        const out = fs.createWriteStream(outfile);
        https.get(url, (resp) => {
            resp.pipe(out);
            out.on('finish', () => {
                out.close();
                this.version = ver;
                this.date = date;
                this.readLocal();
            });
        });
    }

    readLocal() {
        try {
            const contents = fs.readFileSync(`data/${this.date}-pci.ids`, 'utf8');
            this.contents = contents.split('\n');
            this.date = this.findDate(this.contents);
        } catch (err) {
            console.error(err);
        }
    }

    loadLocal() {
        const idsFiles = fs.readdirSync('data').filter((file) => file.endsWith('.ids'));
        if (idsFiles.length === 0) {
            this.getLatest();
        } else {
            this.date = idsFiles[0].split('-')[0];
            this.readLocal();
        }
    }

    latestVersion() {
        const webPage = require('https').getSync(this.url).toString().split('\n');
        for (const line of webPage) {
            if (line.includes(this.compressed)) {
                for (const tag of line.split('<')) {
                    if (tag.includes(this.compressed)) {
                        const path = tag.split('"')[1];
                        const ver = path.split('/')[1];
                        const url = `${this.url}${path}`;
                        const urlUncompressed = url.replace('.bz2', '');
                        const resp2 = https.getSync(urlUncompressed).toString().split('\n');
                        for (let i = 0; i < 10; i++) {
                            const l = resp2[i];
                            if (l.includes('Date:')) {
                                const date = l.split(/\s+/).reverse()[1].replace('-', '');
                                return [ver, date, `${this.url}${path}`];
                            }
                        }
                        break;
                    }
                }
                break;
            }
        }
        return ['', '', ''];
    }
}

class Vendor {
    constructor(vendorStr) {
        this.ID = vendorStr.split(' ')[0];
        this.name = vendorStr.replace(`${this.ID} `, '');
        this.devices = {};
    }

    addDevice(deviceStr) {
        const s = deviceStr.trim();
        const devID = s.split(' ')[0];

        if (!(devID in this.devices)) {
            this.devices[devID] = new Device(deviceStr);
        }
    }

    report() {
        console.log(`${this.ID} ${this.name}`);
        for (const [id, dev] of Object.entries(this.devices)) {
            dev.report();
        }
    }
}

class Device {
    constructor(deviceStr) {
        const s = deviceStr.trim();
        this.ID = s.split(' ')[0];
        this.name = s.replace(`${this.ID}  `, '');
        this.subdevices = {};
    }

    report() {
        console.log(`\t${this.ID}\t${this.name}`);
        for (const [subID, subdev] of Object.entries(this.subdevices)) {
            subdev.report();
        }
    }

    addSubDevice(subDeviceStr) {
        const s = subDeviceStr.trim();
        const spl = s.split(' ');
        const subVendorID = spl[0];
        const subDeviceID = spl[1];
        const subDeviceName = s.split('  ').pop();
        const devID = `${subVendorID}:${subDeviceID}`;

        this.subdevices[devID] = new SubDevice(subVendorID, subDeviceID, subDeviceName);
    }
}

class SubDevice {
    constructor(vendor, device, name) {
        this.vendorID = vendor;
        this.deviceID = device;
        this.name = name;
    }

    report() {
        console.log(`\t\t${this.vendorID}\t${this.deviceID}\t${this.name}`);
    }
}

if (require.main === module) {
    const pciIds = new PCIIds();
    pciIds.report();
}
