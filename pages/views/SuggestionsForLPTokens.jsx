import { ConfigProvider, Table, Button, Tag, Modal } from "antd";
import { DownOutlined, UpOutlined } from "@ant-design/icons";
import { useState, useEffect } from "react";
import { getColumnsForSuggestionsTable } from "../../utils/tableExpansionUtils";

const useModalState = () => {
  const [openModalId, setOpenModalId] = useState(null);
  const [modalPosition, setModalPosition] = useState({ left: 0, top: 0 });

  const handleModalToggle = (id, e) => {
    setOpenModalId((prevId) => (prevId === id ? null : id));

    const buttonRect = e.target.getBoundingClientRect();
    const modalTop = buttonRect.bottom + 20;
    setModalPosition({ top: modalTop });
  };

  const isModalOpen = (id) => openModalId === id;

  return {
    isModalOpen,
    handleModalToggle,
    modalPosition,
  };
};

const SuggestionsForLPTokens = (props) => {
  const { wording, topNData } = props;
  const { isModalOpen, handleModalToggle, modalPosition } = useModalState();

  const columnsForParentRows = [
    {
      title: "Pool",
      dataIndex: "pool",
      key: "pool",
      width: 50,
      render: (pool) => <span style={{ color: "#ffffff" }}>{pool}</span>,
    },
    {
      title: "APR",
      key: "apr",
      dataIndex: "apr",
      width: 35,
      render: (_, record) => {
        return (
          <>
            <Tag key={`${record.pool}-${record.apr}`}>{record.apr}</Tag>
          </>
        );
      },
    },
    {
      title: "",
      key: "",
      dataIndex: "",
      width: 15,
      render: (_, record) => {
        const isOpen = isModalOpen(record.key);
        const modalContent = handleDataClick(record);
        // const icon = ;
        return (
          <>
            <Modal
              open={isOpen}
              onCancel={(e) => handleModalToggle(record.key, e)}
              footer={null}
              closeIcon={false}
              mask={true}
              getContainer={false}
              maskStyle={{ backgroundColor: "rgba(0, 0, 0, 0.5)" }}
              width={"85%"}
              style={{
                top: modalPosition.top,
              }}
              bodyStyle={{
                borderTopLeftRadius: 20,
                borderTopRightRadius: 20,
              }}
            >
              {modalContent}
            </Modal>
            <Button
              type="text"
              icon={
                isOpen ? (
                  <UpOutlined style={{ color: "white" }} />
                ) : (
                  <DownOutlined style={{ color: "white" }} />
                )
              }
              onClick={(e) => handleModalToggle(record.key, e)}
            />
          </>
        );
      },
    },
  ];

  const [data, setData] = useState([]);

  useEffect(() => {
    if (topNData) {
      const extractedData = topNData
        .filter((metadata) => metadata[1].length > 0)
        .map((metadata, idx) => {
          return {
            key: idx,
            pool: metadata[0],
            apr: (metadata[2] * 100).toFixed(2) + "%",
          };
        });
      setData(extractedData);
    }
  }, [topNData]);

  const handleDataClick = (record) => {
    const filteredArray = topNData.filter(
      (metadata) => metadata[0] === record["pool"],
    );
    if (filteredArray.length > 0 && Array.isArray(filteredArray[0][1])) {
      const nestedArray = filteredArray[0][1];
      const data = nestedArray.map((metadata, idx) => {
        return {
          key: idx.toString(),
          chain: metadata.pool_metadata.chain,
          pool: metadata.pool_metadata.project,
          tokens: metadata.pool_metadata.symbol,
          tvl: metadata.pool_metadata.tvlUsd / 1e6,
          apr: ((metadata.pool_metadata.apy / 100 + 1) ** (1 / 365) - 1) * 365,
        };
      });
      const commonColumns = getColumnsForSuggestionsTable();
      const popoverContent = (
        <Table
          columns={[...commonColumns]}
          dataSource={data}
          pagination={false}
          scroll={{
            x: 700,
            y: props.windowHeight / 1.5,
          }}
        />
      );
      return popoverContent;
    }
  };

  return (
    <>
      <h2 className="ant-table-title">{wording}</h2>
      <ConfigProvider
        theme={{
          components: {
            Tag: {
              defaultBg: "#fafafa",
            },
          },
          token: {
            colorBgContainer: "#000000",
            colorBorderSecondary: "#000000",
            colorFillAlter: "#5DFDCB",
            colorText: "#000000",
            colorPrimary: "#5DFDCB",
          },
        }}
      >
        <Table
          columns={columnsForParentRows}
          // expandable={{
          //     expandedRowRender: (record) => expandedRowRender(record),
          //     defaultExpandedRowKeys: ["0"],
          // }}
          dataSource={data}
          pagination={false}
          locale={{
            emptyText: <span style={{ color: "#ffffff" }}>No data</span>,
          }}
          scroll={{
            y: props.windowHeight,
          }}
        />
      </ConfigProvider>
    </>
  );
};
export default SuggestionsForLPTokens;
