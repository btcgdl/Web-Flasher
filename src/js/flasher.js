import * as fastboot from 'android-fastboot';

const deviceinfo = [{
  'name': 'oneplus-enchilada',
  'nicename': 'OnePlus 6',
  'filter': {
    'product': 'sdm845'
  },
  'script': [
    {
      type: "flash",
      // size: 2897200992,
      size: 734292888, //postmarketOS oneplus-enchilada.img.xz
      // url: "https://elasticbeanstalk-us-west-2-190312923858.s3.us-west-2.amazonaws.com/boot.img.xz",
      url: "https://images.postmarketos.org/bpo/v24.12/oneplus-enchilada/gnome-mobile/20250219-1310/20250219-1310-postmarketOS-v24.12-gnome-mobile-3-oneplus-enchilada.img.xz",
      partition: "userdata",
      name: "Flash rootfs"
    },
    {
      type: "flash",
      // size: 31595068,
      size: 23749736, // postmarketOS oneplus-enchilada-boot.img.xz
      // url: "https://elasticbeanstalk-us-west-2-190312923858.s3.us-west-2.amazonaws.com/system.img.xz",
      url: "https://images.postmarketos.org/bpo/v24.12/oneplus-enchilada/gnome-mobile/20250219-1310/20250219-1310-postmarketOS-v24.12-gnome-mobile-3-oneplus-enchilada-boot.img.xz",
      partition: 'boot',
      name: "Flash boot"
    },
    {
      type: "cmd",
      command: "erase:dtbo",
      name: "Erase DTBO partition"
    },
    /*
    {
      type: "cmd",
      command: "erase:dtbo_b",
      name: "Erase DTBO partition"
    },*/
    {
      type: "cmd",
      command: "reboot",
      name: "Reboot"
    },
  ]
}
];

// Create a new FastbootDevice instance
let device = new fastboot.FastbootDevice();
window.device = device;

// Enable verbose debug logging
fastboot.setDebugLevel(2);

// Create the table
const table = document.getElementById("devices");

const row = document.createElement('TR');

const td_product = document.createElement('TD');
const td_start = document.createElement('TD');

row.appendChild(td_product);
row.appendChild(td_start);
table.appendChild(row);

async function StartFlashing(event) {
  event.preventDefault();
  console.log("Start flashing");
  td_product.textContent = "Start flashing";
  await RunScript(deviceinfo[0]['script']);
}

async function RunScript(script) {

  let progressBar = document.createElement('PROGRESS');
  progressBar.value = 0;

  for (let i = 0; i < script.length; i++) {
    const step = script[i];

    switch (step.type) {
      case 'flash':
        td_product.textContent = `Downloading...  ${step.partition}`;
        // td_product.appendChild(progressBar);
        const xzResponse = await fetch(step.url);
        let received = 0;
        const res = new Response(new ReadableStream({
          async start(controller) {
            const streamReader = xzResponse.body.getReader(); // Renamed to avoid conflict
            for (; ;) {
              const { done, value } = await streamReader.read();
              if (done) break;
              received += value.byteLength;
              /*
              progressBar.value = received;
              if (progressBar.value === progressBar.max) {
                progressBar.style.color = '#f00';
                progressBar.style.color = '#090';
              }*/
              controller.enqueue(value);
            }
            controller.close();
          }
        }));

        const reader = new xzwasm.XzReadableStream(res.body);
        await device.flashBlob(step.partition, reader, step.size, function(progress) {
          td_product.textContent = `Flashing...  ${step.partition}`;
        });
        break;
      case 'cmd':
        let result = (await device.runCommand(step.command)).text;
        console.log(result);
        break;
    }
  }
};

async function OnConnectDevice() {
  console.log('connect', device);

  try {
    await device.connect();
  } catch (error) {
    statusField.textContent = `Failed to connect to device: ${error.message}`;
    return;
  }

  // Get the product name
  const product = await device.getVariable("product");

  let result;

  for (let index = 0; index < deviceinfo.length; index++) {
    const di = deviceinfo[index];
    if (di['filter']['product'] === product) {
      result = di['nicename'];
      break
    }
  }
  let status = `Connected to ${result}`;
  td_product.textContent = status;

  // Check if the button is already added
  if (td_start.children.length > 0) return;

  // Add button to start flashing
  const startButton = document.createElement('BUTTON');
  startButton.textContent = 'Start flashing';
  // add classes to tailwindcss and move to right
  startButton.classList.add('bg-[#fd961a]', 'hover:bg-[#a06713]', 'text-white', 'font-semibold', 'py-2', 'px-4', 'rounded', 'transition', 'ml-auto');
  startButton.addEventListener('click', flashFromFile);

  td_start.classList.add('flex', 'items-center', 'justify-center');
  td_start.appendChild(startButton);

}
function getFileType(filename) {
  // Convert the filename to lowercase
  const name = filename.toLowerCase();

  if (name.endsWith('system.img')) {
    return 'userdata';
  }
  else if (name.endsWith('boot.img')) {
    return 'boot';
  }

  else {
    return "Type of file not recognized";
  }
}

async function flashFromFile(event) {
  event.preventDefault();

  let fileField = document.querySelector(".flash-file");
  let file = fileField.files[0];
  let size = file.size;

  const filename = file.name;
  console.log(filename);

  const fileType = getFileType(filename);

  td_product.textContent = `Flashing...  ${fileType} 0%`;
  await device.flashBlob(fileType, file, (progress) => {
    var percentage = Math.round(progress * 100);
    td_product.textContent = `Flashing...  ${fileType} ${percentage}%`;
  });

  td_product.textContent = `Flashing...  ${fileType} done`;

  fileField.value = "";
}

async function EraseOldData(event) {
  event.preventDefault();
  await device.runCommand("erase:boot")
  await device.runCommand("erase:userdata")
  await device.runCommand("erase:system_b")
}

async function ReebotDevice(event) {
  event.preventDefault();
  await device.runCommand("erase:dtbo_a");
  await device.runCommand("erase:dtbo_b");
  await device.runCommand("reboot");
}

document.addEventListener("DOMContentLoaded", async function() {
  // Get DOM elements with clear, consistent variable names
  const connectedDiv = document.getElementById('ConnectedDev');
  const supportedDiv = document.getElementById('SupportedDev');
  const warningDiv = document.getElementById('warning');
  const notSupportedDiv = document.getElementById('notsupported');
  const instructions = document.getElementById('instructions');

  // Check WebUSB support and manage element visibility
  if (navigator.usb === undefined) {
    warningDiv.style.display = 'none';         // Hide warning
    supportedDiv.style.display = 'none';      // Hide supported devices
    connectedDiv.style.display = 'none';      // Hide connected devices
    instructions.style.display = 'none';      // Hide instructions
    console.error('No WebUSB support detected');
  } else {
    notSupportedDiv.style.display = 'none';   // Hide "not supported" message
    connectedDiv.style.display = 'none';      // Initially hide connected devices
  }
  // Add event listener to the warning button
  const warningButton = document.getElementById('warning-button');
  warningButton.addEventListener('click', function(event) {
    event.preventDefault();
    warningDiv.style.display = 'none';   // Hide warning on click
    supportedDiv.style.display = 'block';   // Show supported devices on click
  });
  // Add event listener to the continue button
  const continueButton = document.getElementById('continue-button');
  continueButton.addEventListener('click', function(event) {
    event.preventDefault();
    connectedDiv.style.display = 'block';   // Show connected devices on click
    instructions.style.display = 'none';   // Show instructions on click
  });

  // Add event listener to connect button
  const requestDeviceButton = document.getElementById('request-device');
  requestDeviceButton.addEventListener('click', async function(event) {
    event.preventDefault();
    try {

      td_product.classList.add('text-left');
      td_product.textContent = "Connecting to device...";
    } catch (err) {
      // No device selected
      console.error(err);
    }
    if (device !== undefined) {
      OnConnectDevice();
    }

  });

  const eraseOldDataButton = document.getElementById("erase-old-data");
  eraseOldDataButton.addEventListener('click', EraseOldData);
  const rebootButton = document.getElementById('reboot-device');
  rebootButton.addEventListener('click', ReebotDevice);

  const suppTable = document.getElementById('supporteddevices');
  for (let i = 0; i < deviceinfo.length; i++) {
    const di = deviceinfo[i];
    const row = document.createElement('TR');
    const td_name = document.createElement('TD');
    const name_link = document.createElement('A');
    name_link.innerText = di['nicename'];
    td_name.appendChild(name_link);
    row.appendChild(td_name);
    const td_codename = document.createElement('TD');
    td_codename.innerText = di['name'];
    row.appendChild(td_codename);
    suppTable.appendChild(row);
  }
});
