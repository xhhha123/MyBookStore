<%@ Page Title="Home Page" Language="C#" MasterPageFile="~/Site.master" AutoEventWireup="true"
    CodeBehind="Upload.aspx.cs" Inherits="MyBookstoreApplication._Upload" %>

<asp:Content ID="HeaderContent" runat="server" ContentPlaceHolderID="HeadContent">
</asp:Content>
<asp:Content ID="BodyContent" runat="server" ContentPlaceHolderID="MainContent">
    <h2>
        Upload a document
    </h2>
 	<p>
    Create a new web document from an existing file! File types supported: pdf, xps, office, etc... (see <a href="http://www.pdftron.com/pdfnet/cloud/started.html#supportedFileTypes" target="_blank">full list of support</a>)<br/>
	For this sample, the maximum file size to upload is 20MB.
    </p>
	<p>
	<span style="color: red">
		Note that any files uploaded will become publicly viewable in this sample.
		Please take caution to protect your sensitive documents.
	</span>
	<br/>
	To create web documents that are private and confidential, please <a href="https://www.pdftron.com/pdfnet/cloud/signup.html">sign up</a> for a free evaluation account.<br/>
	Once signed up, you may upload files directly through the <a href="https://api.pdftron.com/user/index.xhtml">Cloud API management website</a> or <a href="http://www.pdftron.com/pdfnet/cloud/samples.html">download</a> and run this sample.
	</p>

    <div>
    <asp:Label ID="FileSizeLimit" runat="server"></asp:Label>
    </div>
    <div>
    <asp:FileUpload ID="FileUploadControl" runat="server"></asp:FileUpload>
    </div>
    <div>
    <asp:Button ID="UploadButton" Text="Upload" runat="server" OnClick="UploadButton_Click"  />
    </div>
    <br />
    <div>
    <asp:Button ID="DocumentStatus" Text="DocumentStatus" runat="server" OnClick="DocumentStatus_Click"  />
        &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
        <asp:TextBox ID="txtStatusId" runat="server" Width="320px"></asp:TextBox>
    </div>
    <br />
    <div>
    <asp:Button ID="DeleteDocument" Text="DeleteDocument" runat="server" OnClick="DeleteDocument_Click"  />
                &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
        <asp:TextBox ID="txtDeleteId" runat="server" Width="320px"></asp:TextBox>
    </div>
    <br />
    <div>
    <asp:Button ID="CreateSession" Text="CreateSession" runat="server" OnClick="CreateSession_Click"   />
        &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
        <asp:TextBox ID="txtSessionId" runat="server" Width="320px"></asp:TextBox>
        &nbsp;&nbsp;&nbsp;
        Exp:&nbsp;<asp:TextBox ID="txtMin" runat="server" Width="50px">120</asp:TextBox> minutes
        <br />
        User &nbsp;<asp:TextBox ID="txtUser" runat="server" Width="50px"></asp:TextBox> 
        UserId &nbsp;<asp:TextBox ID="txtUserId" runat="server" Width="320px"></asp:TextBox> 
        <br />
                <asp:CheckBox ID="chkShowtoolbar" runat="server" />ShowtoolbarControl
                <asp:CheckBox ID="chkReadOnly" runat="server" />Enable Read Only Mode
                <asp:CheckBox ID="chkAnnotation" runat="server" />Annotations
                <asp:CheckBox ID="chkOfficeMode" runat="server" />Enable Office Mode
                <asp:CheckBox ID="chkAdmin" runat="server" />Admin
        <br />

        <asp:Button ID="View" Text="View" runat="server" OnClick="View_Click"  />


    </div>
    <br />
    <div>
    <asp:Button ID="DownloadDocument" Text="DownloadDocument" runat="server" OnClick="DownloadDocument_Click"  />
                &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
        <asp:TextBox ID="txtDownloadId" runat="server" Width="320px"></asp:TextBox>
        &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
        <asp:DropDownList ID="ddtDownloadType" runat="server">
            	<asp:ListItem Value="original">original</asp:ListItem>
				<asp:ListItem Value="xod">xod</asp:ListItem>
				<asp:ListItem Value="pdf">pdf</asp:ListItem>
				<asp:ListItem Value="thumbnail">thumbnail</asp:ListItem>
				<asp:ListItem Value="epub">epub</asp:ListItem>
        </asp:DropDownList>
            </div>
        <br />
        <br />
    We have to convert the local xfdf files and xod files to PDF because of PDFTron do not support this function
    <div>
        <asp:Button ID="DownloadWithAnnotation" Text="DownloadWithAnnotation" runat="server" OnClick="DownloadWithAnnotation_Click"/>
        &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
        <asp:TextBox ID="txtDocumentId" runat="server" Width="320px"></asp:TextBox>
        User &nbsp;<asp:TextBox ID="txtAnnotationUser" runat="server" Width="50px"></asp:TextBox> 

    </div>
    <br />

    <asp:Label ID="lbMessage" runat="server" Text="Label"></asp:Label>
    
    <br />
<%--    <a href="<%this.linkBtn.Text.ToString()%>"></a>--%>
    <asp:HyperLink ID="link" runat="server" Visible="false"></asp:HyperLink>
</asp:Content>
