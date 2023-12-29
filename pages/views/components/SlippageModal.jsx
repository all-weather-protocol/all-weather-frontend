import { ConfigProvider, Modal, Radio } from "antd";

const SlippageModal = ({
  slippage,
  setSlippage,
  slippageModalOpen,
  setSlippageModalOpen,
}) => {
  return (
    <Modal
      title="Slippage Settings"
      centered
      open={slippageModalOpen}
      onCancel={() => setSlippageModalOpen(false)}
      footer={null}
    >
      <p style={{ margin: "10px 0" }}>
        Setting a high slippage tolerance can help transactions succeed, but you
        may not get such a good price. Use with caution.
      </p>
      <ConfigProvider
        theme={{
          token: {
            colorPrimary: "#5DFDCB",
            colorTextLightSolid: "#000000",
          },
        }}
      >
        <Radio.Group
          value={slippage}
          buttonStyle="solid"
          onChange={(e) => setSlippage(e.target.value)}
        >
          <Radio.Button value={0.1}>0.1%</Radio.Button>
          <Radio.Button value={0.5}>0.5%</Radio.Button>
          <Radio.Button value={1}>1%</Radio.Button>
        </Radio.Group>
      </ConfigProvider>
    </Modal>
  );
};

export default SlippageModal;
